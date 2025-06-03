import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.ObjectId,
            required: true
        },
        shopItem: {
            id: {
                type: mongoose.Schema.ObjectId,
                required: true
            },
            title: {
                type: String,
                required: true
            },
            description: {
                type: String,
                required: true
            },
            evaluatorLimit: {
                type: Number,
                required: true,
                default: 0
            },
            evaluationLimit: {
                type: Number,
                required: true,
                default: 0
            },
            classesLimit: {
                type: Number,
                required: true,
                default: 0
            },
            price: {
                type: Number,
                required: true
            },
        },
        orderId: {
            type: String,
            required: true
        },
        amount: {
            type: Number,
            required: true,
        },
        isCompleted: {
            type: Boolean,
            default: false
        },
    },
    { timestamps: true }
);

const Order = mongoose.model("Order", OrderSchema);

export default Order;