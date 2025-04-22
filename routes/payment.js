const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const db = require('../config/connection'); // Import database connection
const collection = require('../config/collections'); // Import collections
const router = express.Router();

const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_SECRET
}); 

// Create order route
router.post('/create-order', async (req, res) => {
    const { amount } = req.body;
 
    const options = {
        amount: amount * 100, // Amount in paise
        currency: "INR",
        receipt: "order_rcptid_" + Math.floor(Math.random() * 10000)
    };

    try {
        const order = await razorpayInstance.orders.create(options);
        res.render('user/razorpay-payment', {
            key_id: process.env.RAZORPAY_KEY_ID,
            order 
        });
    } catch (err) {
        console.error("Order creation error:", err);
        res.status(500).send("Error creating Razorpay order");
    }
});

router.get('/razorpay-payment', (req, res) => {
    res.render('user/razorpay-payment');
});

module.exports = router;
