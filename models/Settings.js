import mongoose from "mongoose";
import { aiModels, defaultAIModel } from "../utils/models.js";
import { defaultPaymentGateway, paymentGateways } from "../utils/payment.js";

const SettingsSchema = new mongoose.Schema(
    {
        aiModel: {
            type: String,
            required: true,
            default: defaultAIModel,
            enum: aiModels.map((model) => model.model),
        },
        paymentGateway: {
            type: String,
            required: true,
            default: defaultPaymentGateway,
            enum: paymentGateways.map((gateway) => gateway.code),
        },
    },
    {
        timestamps: true,
    }
);

const Settings = mongoose.model("Settings", SettingsSchema);

export default Settings;