const crypto = require('crypto');

router.post('/verify-payment', verifyLogin, async (req, res) => {
    try {
        const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

        // Generate the expected signature
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_SECRET)
            .update(`${razorpayOrderId}|${razorpayPaymentId}`)
            .digest('hex');

        if (generatedSignature === razorpaySignature) {
            // Update the order status to "SUCCESS"
            await db.get().collection(collection.ORDER_COLLECTION).updateOne(
                { razorpayOrderId },
                { $set: { status: 'Arriving Soon', razorpayPaymentId } }
            );

            // Clear the cart
            const userId = req.session.user._id;
            await db.get().collection(collection.CART_COLLECTION).deleteOne({ user: new ObjectId(userId) });

            return res.json({ success: true, redirect: '/order-success' });
        } else {
            // Payment verification failed
            return res.json({ success: false, message: 'Payment verification failed' });
        }
    } catch (err) {
        console.error('Error verifying payment:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});