import joi from "joi";
import { hash, compare } from "@uswriting/bcrypt";
import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import {
  appName,
  defaultClassesLimit,
  defaultEvaluationLimit,
  defaultEvaluatorLimit,
  logoBase64,
  skipEmailVerification,
} from "../utils/config.js";
import dotenv from "dotenv";
import EmailVerification from "../models/EmailVerification.js";
import nodemailer from "nodemailer";
import smtpTransport from "nodemailer-smtp-transport";
import Limits from "../models/Limits.js";
import { validate } from "../middlewares/validate.js";
import Settings from  "../models/Settings.js";
import { defaultAIModel } from "../utils/models.js";
import { defaultPaymentGateway } from "../utils/payment.js";
import Evaluator from "../models/Evaluator.js";
import Class from "../models/Class.js";
import EvaluationUsage from "../models/EvaluationUsage.js";
import passport from "../utils/passport.js";

dotenv.config();

const router = express.Router();

// Middleware to ensure user is authenticated with Passport
function ensureAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).send("Unauthorized");
}

// Get current user profile
router.get("/", validate, async (req, res) => {
  const user = await User.findById(req.user._id).select("-password");
  res.send(user);
});

// Get current user's limits and usage
router.get("/limits", validate, async (req, res) => {
  const limits = await Limits.findOne({ userId: req.user._id }).lean();

  const evaluators = await Evaluator.find({ userId: req.user._id }).countDocuments();
  const classes = await Class.find({ userId: req.user._id }).countDocuments();
  const evaluations = await EvaluationUsage.find({ userId: req.user._id }).countDocuments();

  limits.evaluatorUsage = evaluators;
  limits.classesUsage = classes;
  limits.evaluationUsage = evaluations;

  res.send(limits);
});

// Login with email and password
router.post("/login", async (req, res) => {
  const schema = joi.object({
    email: joi.string().min(6).required().email(),
    password: joi.string().min(6),
  });

  try {
    const data = await schema.validateAsync(req.body);

    const user = await User.findOne({ email: data.email });

    if (!user) return res.status(400).send("Email or password is wrong");

    // Check if user is a Google auth user
    if (user.authType === "google") {
      return res.status(400).send("This account uses Google Sign-In. Please login with Google.");
    }

    const validPassword = compare(data.password, user.password);

    if (!validPassword)
      return res.status(400).send("Email or password is wrong");

    const token = jwt.sign({ _id: user._id }, process.env.TOKEN_SECRET);

    return res.send({ user, token });
  } catch (err) {
    return res.status(500).send(err);
  }
});

// Send verification code
async function sendEmail(email, res) {
  const transporter = nodemailer.createTransport(
    smtpTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      requireTLS: true,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  );

  const minm = 100000;
  const maxm = 999999;
  const code = Math.floor(Math.random() * (maxm - minm + 1)) + minm;
  const logoHTML = `<img width="200px" src='cid:logo'/>`;

  const options = {
    from: `${appName} <${process.env.SMTP_USER}>`,
    to: email,
    subject: `Verify your email address`,
    attachments: [
      {
        filename: `${appName}.png`,
        path: logoBase64, // base64 image of logo
        cid: "logo",
      },
    ],
    html: `<div style="height:100%;background:black;color:white;padding:40px;"><center>${logoHTML}<br/><h2>Verify your email</h2></center><br/><p style="font-size:18px;">${appName} verification code: <b>${code.toString()}</b></p><br/><br/></div>`,
  };

  transporter.sendMail(options, async (err, info) => {
    if (err) {
      console.log(err);
      return res.status(500).send(err);
    }

    console.log("Email sent: " + info.response);

    const emailVerification = await EmailVerification.findOne({ email });
    if (emailVerification) {
      await EmailVerification.findOneAndUpdate(
        { email },
        { code: code.toString() }
      );
    } else {
      const newEmailVerification = new EmailVerification({
        email,
        code: code.toString(),
        isVerified: false,
      });
      await newEmailVerification.save();
    }

    // Store in User model for old system compatibility
    await User.findOneAndUpdate(
      { email },
      {
        verificationCode: code.toString(),
        verificationCodeExpiry: new Date(Date.now() + 10 * 60 * 1000),
      }
    );

    return res.send("Email sent!");
  });
}

router.post("/send-verification-code", async (req, res) => {
  const schema = joi.object({
    email: joi.string().email().required(),
  });

  try {
    const data = await schema.validateAsync(req.body);

    // Check if email is already verified
    const emailVerification = await EmailVerification.findOne({ email: data.email });
    if (emailVerification && emailVerification.isVerified)
      return res.status(400).send("Email already verified");

    // Check if user exists, create temp user if not (old system compatibility)
    let user = await User.findOne({ email: data.email });
    if (!user) {
      user = new User({
        email: data.email,
        name: "Temp",
        googleId: "temp-" + Date.now(),
        authType: "local",
      });
      await user.save();
    }

    if (skipEmailVerification) {
      if (emailVerification) {
        await EmailVerification.findOneAndUpdate(
          { email: data.email },
          { code: "0000", isVerified: true }
        );
      } else {
        const newEmailVerification = new EmailVerification({
          email: data.email,
          code: "0000",
          isVerified: true,
        });
        await newEmailVerification.save();
      }
      // Update User model for old system
      await User.findOneAndUpdate(
        { email: data.email },
        { verificationCode: "0000", verificationCodeExpiry: null }
      );
      return res.send({ skip: true });
    } else {
      await sendEmail(data.email, res);
    }
  } catch (err) {
    console.log(err);
    return res.status(500).send(err);
  }
});

// Verify email and create user
router.post("/verify-email-signup", async (req, res) => {
  const schema = joi.object({
    email: joi.string().email().required(),
    code: joi.string().required(),
    name: joi.string().min(3).required(),
    password: joi.string().min(6).required(),
  });

  try {
    const data = await schema.validateAsync(req.body);
    const emailVerification = await EmailVerification.findOne({ email: data.email });
    const user = await User.findOne({ email: data.email });

    if (!user) return res.status(404).send("User not found");

    // Check both models for compatibility
    const isValidCode =
      (emailVerification && (emailVerification.code === data.code || skipEmailVerification)) ||
      (user.verificationCode === data.code && user.verificationCodeExpiry > new Date());

    if (isValidCode) {
      // Update verification status
      if (emailVerification) {
        await EmailVerification.updateOne({ email: data.email }, { isVerified: true });
      }
      await User.findOneAndUpdate(
        { email: data.email },
        { verificationCode: null, verificationCodeExpiry: null }
      );

      // Check if user exists with this email
      const existingUser = await User.findOne({ email: data.email });
      if (existingUser) {
        if (existingUser.authType === "google") {
          return res.status(400).send("This email is already registered with Google. Please login with Google.");
        }
        return res.status(400).send("Email already exists");
      }

      const hashedPassword = hash(data.password, 10);

      const users = await User.find();

      if (users.length === 0) {
        const settings = new Settings({
          aiModel: defaultAIModel,
          paymentGateway: defaultPaymentGateway,
        });
        await settings.save();
      }

      const newUser = new User({
        name: data.name,
        email: data.email,
        password: hashedPassword,
        type: users.length === 0 ? 0 : 1,
        authType: "local",
      });

      const savedUser = await newUser.save();

      const newLimits = new Limits({
        userId: savedUser._id,
        evaluatorLimit: defaultEvaluatorLimit,
        evaluationLimit: defaultEvaluationLimit,
        classesLimit: defaultClassesLimit,
      });

      await newLimits.save();

      return res.send(savedUser);
    } else {
      return res.status(400).send("Invalid or expired verification code");
    }
  } catch (err) {
    console.log(err);
    return res.status(500).send(err);
  }
});

// Verify code (from old system)
router.post("/verify-code", async (req, res) => {
  const schema = joi.object({
    email: joi.string().email().required(),
    code: joi.string().required(),
  });

  try {
    const data = await schema.validateAsync(req.body);
    const user = await User.findOne({ email: data.email });
    const emailVerification = await EmailVerification.findOne({ email: data.email });

    if (!user) return res.status(404).send("User not found");

    // Check both models for compatibility
    const isValidCode =
      (emailVerification && (emailVerification.code === data.code || skipEmailVerification)) ||
      (user.verificationCode === data.code && user.verificationCodeExpiry > new Date());

    if (isValidCode) {
      // Update both models
      if (emailVerification) {
        await EmailVerification.updateOne({ email: data.email }, { isVerified: true });
      }
      await User.findOneAndUpdate(
        { email: data.email },
        { verificationCode: null, verificationCodeExpiry: null }
      );
      res.send("Email verified successfully");
    } else {
      res.status(400).send("Invalid or expired verification code");
    }
  } catch (error) {
    console.error("Verify code error:", error);
    res.status(500).send("Internal server error");
  }
});

// Create user (from old system, e.g., for Google OAuth)
router.post("/user-created", async (req, res) => {
  const schema = joi.object({
    googleId: joi.string().required(),
    email: joi.string().email().required(),
    name: joi.string().allow(""),
  });

  try {
    const data = await schema.validateAsync(req.body);

    const existing = await User.findOne({ googleId: data.googleId });
    if (existing) return res.send("User already exists");

    const users = await User.find();

    const newUser = new User({
      googleId: data.googleId,
      name: data.name || "Unnamed User",
      email: data.email,
      type: users.length === 0 ? 0 : 1, // First user is admin
      authType: "google",
    });

    const savedUser = await newUser.save();

    const newLimits = new Limits({
      userId: savedUser._id,
      evaluatorLimit: defaultEvaluatorLimit,
      evaluationLimit: defaultEvaluationLimit,
      classesLimit: defaultClassesLimit,
    });

    await newLimits.save();

    if (users.length === 0) {
      const settings = new Settings({
        aiModel: defaultAIModel,
        paymentGateway: defaultPaymentGateway,
      });
      await settings.save();
    }

    res.send("User created in DB");
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).send("Internal server error");
  }
});

// Complete onboarding
router.post("/finish-onboarding", validate, async (req, res) => {
  try {
    await User.findOneAndUpdate({ _id: req.user._id }, { onboardingCompleted: true });
    return res.send("Onboarding completed");
  } catch (err) {
    return res.status(500).send(err);
  }
});

// Google OAuth routes
router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  async (req, res) => {
    try {
      let user = await User.findOne({ googleId: req.user.googleId });
      if (!user) {
        const users = await User.find();
        user = new User({
          googleId: req.user.googleId,
          name: req.user.displayName || "Unnamed User",
          email: req.user.email,
          type: users.length === 0 ? 0 : 1,
          authType: "google",
        });
        await user.save();

        const newLimits = new Limits({
          userId: user._id,
          evaluatorLimit: defaultEvaluatorLimit,
          evaluationLimit: defaultEvaluationLimit,
          classesLimit: defaultClassesLimit,
        });
        await newLimits.save();

        if (users.length === 0) {
          const settings = new Settings({
            aiModel: defaultAIModel,
            paymentGateway: defaultPaymentGateway,
          });
          await settings.save();
        }
      }

      const token = jwt.sign({ _id: user._id }, process.env.TOKEN_SECRET);
      res.redirect(`${process.env.FRONTEND_URL || "http://localhost:3000"}/auth/google/success?token=${token}`);
    } catch (error) {
      console.error("Error in Google callback:", error);
      res.redirect(`${process.env.FRONTEND_URL || "http://localhost:3000"}/login?error=auth_failed`);
    }
  }
);

// Check if user is authenticated with Google
router.get("/auth/google/user", async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) return res.status(401).send("Unauthorized");

    jwt.verify(token, process.env.TOKEN_SECRET, async (err, decoded) => {
      if (err) return res.status(401).send("Unauthorized");

      const user = await User.findById(decoded._id).select("-password");
      if (!user) return res.status(404).send("User not found");

      return res.send(user);
    });
  } catch (error) {
    console.error("Error checking Google auth:", error);
    return res.status(500).send("Server error");
  }
});

export default router;