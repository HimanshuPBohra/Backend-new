import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: function () {
        return this.authType === "local";
      },
      minlength: 6,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    profilePicture: {
      type: String,
      default: "",
    },
    type: {
      type: Number,
      enum: [0, 1], // 0: admin, 1: user
      default: 1,
    },
    onboardingCompleted: {
      type: Boolean,
      default: false,
    },
    authType: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    googleAccessToken: {
      type: String,
    },
    googleRefreshToken: {
      type: String,
    },
    verificationCode: {
      type: String,
      default: null,
    },
    verificationCodeExpiry: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", UserSchema);

export default User;