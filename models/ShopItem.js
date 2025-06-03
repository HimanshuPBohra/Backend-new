import mongoose from "mongoose";

const ShopItemSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
        evaluatorLimit: {
            type: Number,
            required: true,
            default: 0,
        },
        evaluationLimit: {
            type: Number,
            required: true,
            default: 0,
        },
        classesLimit: {
            type: Number,
            required: true,
            default: 0,
        },
        price: {
            type: Number,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

const ShopItem = mongoose.model("ShopItem", ShopItemSchema);

export default ShopItem;