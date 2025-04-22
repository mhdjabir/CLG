// filepath: c:\Users\tech\OneDrive\Desktop\project\project\routes\verify-payment.js
const express = require('express');
const crypto = require('crypto');
const db = require('../config/connection'); // Import database connection
const collection = require('../config/collections'); // Import collections
const router = express.Router();

router.post('/', async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Use RAZORPAY_SECRET from .env
    const generatedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_SECRET)
        .update(razorpay_order_id + "|" + razorpay_payment_id)
        .digest('hex');
  
    if (generatedSignature === razorpay_signature) {
        try {
            await db.get().collection(collection.ORDER_COLLECTION).updateOne(
                { razorpayOrderId: razorpay_order_id },
                { $set: { status: "Paid", paymentId: razorpay_payment_id } }
            );

            res.json({ success: true, redirectUrl: '/order-success' });
        } catch (err) {
            console.error('Error updating order status:', err);
            res.status(500).json({ success: false, message: 'Error updating order status' });
        }
    } else {
        res.json({ success: false, message: 'Payment verification failed' });
    }  
});

module.exports = router;