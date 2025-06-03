import express from "express";
import { validateAdmin } from "../middlewares/validate.js";
import User from "../models/User.js";
import Limits from "../models/Limits.js";
import { hash } from "@uswriting/bcrypt";
import joi from "joi";
import Evaluator from "../models/Evaluator.js";
import Class from "../models/Class.js";
import { aiModels } from "../utils/models.js";
import { paymentGateways } from "../utils/payment.js";
import ShopItem from "../models/ShopItem.js";
import Settings from "../models/Settings.js";
import Order from "../models/Order.js";
import EvaluationUsage from "../models/EvaluationUsage.js";
import EmailVerification from "../models/EmailVerification.js";

const router = express.Router();

router.get("/dashboard", validateAdmin, async (req, res) => {
    const shopItems = await ShopItem.countDocuments();
    const settings = await Settings.findOne();
    const users = await User.countDocuments();
    const purchases = await Order.find({ isCompleted: true });
    let earnings = 0;

    for (const purchase of purchases) {
        earnings += purchase.amount;
    }

    return res.send({
        shopItems,
        aiModel: settings.aiModel,
        modelLogo: aiModels.find(model => model.model === settings.aiModel)?.logo || null,
        paymentGateway: paymentGateways.find(gateway => gateway.code === settings.paymentGateway).name,
        gatewayLogo: paymentGateways.find(gateway => gateway.code === settings.paymentGateway).logo,
        users,
        earnings,
    });
});

router.get("/users", validateAdmin, async (req, res) => {
    const users = await User.find().select("-password").lean();

    for (const user of users) {
        const limits = await Limits.findOne({ userId: user._id }).lean();
        const evaluatorUsage = await Evaluator.find({ userId: user._id }).countDocuments();
        const classesUsage = await Class.find({ userId: user._id }).countDocuments();
        const evaluationUsage = await EvaluationUsage.find({ userId: user._id }).countDocuments();
        user.limits = limits;
        user.limits.evaluatorUsage = evaluatorUsage;
        user.limits.classesUsage = classesUsage;
        user.limits.evaluationUsage = evaluationUsage;
    }

    return res.send(users);
});

router.post("/users/update", validateAdmin, async (req, res) => {
    const schema = joi.object({
        userId: joi.string().required(),
        email: joi.string().required(),
        name: joi.string().required(),
        password: joi.string().allow(""),
        evaluatorLimit: joi.number().required(),
        evaluationLimit: joi.number().required(),
        classesLimit: joi.number().required(),
    });

    try {
        const data = await schema.validateAsync(req.body);

        await User.updateOne({ _id: data.userId }, {
            name: data.name,
        });

        await Limits.findOneAndUpdate({ userId: data.userId }, {
            evaluatorLimit: data.evaluatorLimit,
            evaluationLimit: data.evaluationLimit,
            classesLimit: data.classesLimit,
        });

        if (data.password) {
            const hashedPassword = hash(data.password, 10);
            await User.updateOne({ _id: data.userId }, { password: hashedPassword });
        }

        return res.send(data);
    }
    catch (err) {
        return res.status(500).send(err);
    }
});

router.post("/users/delete", validateAdmin, async (req, res) => {
    const schema = joi.object({
        userId: joi.string().required(),
    });

    try {
        const data = await schema.validateAsync(req.body);
        const user = await User.findById(data.userId);

        if (user._id.toString() === req.user._id.toString()) {
            return res.status(400).send("You cannot delete yourself.");
        }

        await User.findByIdAndDelete(data.userId);
        await Limits.findOneAndDelete({ userId: data.userId });
        await Evaluator.deleteMany({ userId: data.userId });
        await Class.deleteMany({ userId: data.userId });
        await EvaluationUsage.deleteMany({ userId: data.userId });
        await EmailVerification.deleteMany({ email: user.email });

        return res.send(user);
    }
    catch (err) {
        return res.status(500).send(err);
    }
});

router.get("/ai-models", validateAdmin, async (req, res) => {
    const settings = await Settings.findOne();

    aiModels.forEach((model) => {
        if (model.model === settings.aiModel) {
            model.selected = true;
        }
        else {
            model.selected = false;
        }
    });

    return res.send(aiModels);
});

router.post("/ai-models/select", validateAdmin, async (req, res) => {
    const schema = joi.object({
        model: joi.string().required(),
    });

    try {
        const data = await schema.validateAsync(req.body);
        await Settings.updateOne({}, { aiModel: data.model });
        return res.send(data);
    }
    catch (err) {
        return res.status(500).send(err);
    }
});

router.get("/payment-gateways", validateAdmin, async (req, res) => {
    const settings = await Settings.findOne();

    paymentGateways.forEach((gateway) => {
        if (gateway.code === settings.paymentGateway) {
            gateway.selected = true;
        }
        else {
            gateway.selected = false;
        }
    });

    return res.send(paymentGateways);
});

router.post("/payment-gateways/select", validateAdmin, async (req, res) => {
    const schema = joi.object({
        gateway: joi.string().required(),
    });

    try {
        const data = await schema.validateAsync(req.body);
        await Settings.updateOne({}, { paymentGateway: data.gateway });
        return res.send(data);
    }
    catch (err) {
        return res.status(500).send(err);
    }
});

router.get("/purchases", validateAdmin, async (req, res) => {
    const orders = await Order.find({ isCompleted: true }).lean();

    for (const order of orders) {
        order.user = await User.findById(order.userId).select("-password");
    }

    return res.send(orders.reverse());
});

router.get("/shop-items", validateAdmin, async (req, res) => {
    return res.send(await ShopItem.find());
});

router.post("/shop-items/new", validateAdmin, async (req, res) => {
    const schema = joi.object({
        title: joi.string().required(),
        description: joi.string().required(),
        evaluatorLimit: joi.number().required(),
        evaluationLimit: joi.number().required(),
        classesLimit: joi.number().required(),
        price: joi.number().required(),
    });

    try {
        const data = await schema.validateAsync(req.body);
        const newItem = new ShopItem(data);
        await newItem.save();
        return res.send(newItem);
    }
    catch (err) {
        return res.status(500).send(err);
    }
});

router.post("/shop-items/edit", validateAdmin, async (req, res) => {
    const schema = joi.object({
        itemId: joi.string().required(),
        title: joi.string().required(),
        description: joi.string().required(),
        evaluatorLimit: joi.number().required(),
        evaluationLimit: joi.number().required(),
        classesLimit: joi.number().required(),
        price: joi.number().required(),
    });

    try {
        const data = await schema.validateAsync(req.body);
        const updatedItem = await ShopItem.findByIdAndUpdate(data.itemId, {
            title: data.title,
            description: data.description,
            evaluatorLimit: data.evaluatorLimit,
            evaluationLimit: data.evaluationLimit,
            classesLimit: data.classesLimit,
            price: data.price
        }, { new: true });

        return res.send(updatedItem);
    }
    catch (err) {
        return res.status(500).send(err);
    }
});

router.post("/shop-items/delete", validateAdmin, async (req, res) => {
    const schema = joi.object({
        itemId: joi.string().required(),
    });

    try {
        const data = await schema.validateAsync(req.body);
        return res.send(await ShopItem.findByIdAndDelete(data.itemId));
    }
    catch (err) {
        return res.status(500).send(err);
    }
});

export default router;
