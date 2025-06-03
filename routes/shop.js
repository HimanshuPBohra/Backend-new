import express from "express";
import { validate } from "../middlewares/validate.js";
import ShopItem from "../models/ShopItem.js";
import Razorpay from "razorpay";
import dotenv from "dotenv";
import { currency } from "../utils/config.js";
import Order from "../models/Order.js";
import joi from "joi";
import Stripe from "stripe";
import Settings from "../models/Settings.js";
import Limits from "../models/Limits.js";
import crypto from "crypto";

dotenv.config();

const router = express.Router();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.get("/", validate, async (req, res) => {
    const settings = await Settings.findOne();
    const paymentMethod = settings.paymentGateway;
    const shopItems = await ShopItem.find();

    return res.send({ shopItems, paymentMethod });
});

router.get("/purchases", validate, async (req, res) => {
    const orders = await Order.find({ userId: req.user._id, isCompleted: true });
    return res.send(orders.reverse());
});

router.post('/create-order', validate, async (req, res) => {
    const schema = joi.object({
        itemId: joi.string().required(),
    });

    try {
        const settings = await Settings.findOne();
        const paymentMethod = settings.paymentGateway;
        const data = await schema.validateAsync(req.body);
        const item = await ShopItem.findById(data.itemId);

        if (!item) return res.status(400).send("Invalid Item");

        if (paymentMethod === "stripe") {
            const paymentIntent = await stripe.paymentIntents.create({
                amount: item.price * 100,
                currency: currency.toLowerCase(),
                automatic_payment_methods: {
                    enabled: true,
                },
            });

            const newOrder = new Order({
                userId: req.user._id,
                itemId: data.itemId,
                shopItem: {
                    id: item._id,
                    title: item.title,
                    description: item.description,
                    evaluatorLimit: item.evaluatorLimit,
                    evaluationLimit: item.evaluationLimit,
                    classesLimit: item.classesLimit,
                    price: item.price,
                },
                orderId: paymentIntent.id,
                amount: paymentIntent.amount / 100,
            });

            await newOrder.save();

            return res.send({
                clientSecret: paymentIntent.client_secret,
            });
        }
        else if (paymentMethod === "razorpay") {
            const orderOptions = {
                amount: item.price * 100,
                currency: currency,
                receipt: 'order_rcptid_' + Math.random().toString(),
                payment_capture: 1,
            };

            const order = await razorpay.orders.create(orderOptions);

            const newOrder = new Order({
                userId: req.user._id,
                itemId: data.itemId,
                shopItem: {
                    id: item._id,
                    title: item.title,
                    description: item.description,
                    evaluatorLimit: item.evaluatorLimit,
                    evaluationLimit: item.evaluationLimit,
                    classesLimit: item.classesLimit,
                    price: item.price,
                },
                orderId: order.id,
                amount: order.amount / 100,
            });

            const orderData = await newOrder.save();

            const resData = {
                key: process.env.RAZORPAY_KEY_ID,
                amount: orderData.amount,
                currency: currency,
                name: item.title,
                description: item.description,
                order_id: orderData.orderId,
            };

            return res.json(resData);
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to create order' });
    }
});

router.post('/razorpay/verify-order', validate, async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const generated_signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(razorpay_order_id + '|' + razorpay_payment_id)
        .digest('hex');

    if (generated_signature === razorpay_signature) {
        const order = await Order.findOne({ orderId: razorpay_order_id });

        if (!order || order.isCompleted) return res.status(400).send('Invalid Order');

        await Order.findOneAndUpdate({ orderId: razorpay_order_id }, { isCompleted: true });

        await Limits.findOneAndUpdate({ userId: req.user._id }, {
            $inc: {
                evaluatorLimit: order.shopItem.evaluatorLimit,
                evaluationLimit: order.shopItem.evaluationLimit,
                classesLimit: order.shopItem.classesLimit,
            }
        });

        return res.send(await Order.findOne({ orderId: razorpay_order_id }));
    } else {
        return res.status(400).send('Payment verification failed');
    }
});

router.post('/stripe/verify-order', validate, async (req, res) => {
    const { payment_intent, redirect_status } = req.body;

    if (redirect_status === 'succeeded') {
        const order = await Order.findOne({ orderId: payment_intent });

        if (!order || order.isCompleted) return res.status(400).send('Invalid Order');

        await Order.findOneAndUpdate({ orderId: payment_intent }, { isCompleted: true });

        await Limits.findOneAndUpdate({ userId: req.user._id }, {
            $inc: {
                evaluatorLimit: order.shopItem.evaluatorLimit,
                evaluationLimit: order.shopItem.evaluationLimit,
                classesLimit: order.shopItem.classesLimit,
            }
        });

        return res.send(await Order.findOne({ orderId: payment_intent }));
    } else {
        return res.status(400).send('Payment verification failed');
    }
});

export default router;