const express = require('express');
const router = express.Router();
const db = require('../config/connection'); // Import database connection
const collection = require('../config/collections'); // Import collections
const productHelpers = require('../helpers/product-helpers');
const userHelpers = require('../helpers/user-helpers');
const { ObjectId } = require('mongodb'); // Import ObjectId for MongoDB operations
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay instance
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID, // Use the key from .env
    key_secret: process.env.RAZORPAY_SECRET, // Use the secret from .env
});

// Middleware to verify if the user is logged in
const verifyLogin = (req, res, next) => {
    if (req.session.loggedIn) {
        next();  
    } else {
        res.redirect('/login?redirect=feed'); // Redirect with a query parameter
    }
};
 
// GET home page
router.get('/', async (req, res) => {
    const user = req.session.user;
    try {
        const products = await productHelpers.getAllproducts();
        res.render('user/view-products', { products, user, home: true });
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).send('Error fetching products');
    }
});

// GET login page
router.get('/login', (req, res) => {
    if (req.session.loggedIn) {
        return res.redirect('/');
    }
    const redirectMessage = req.query.redirect ? 'Please log in to continue.' : null;
    res.render('user/login', { loginErr: req.session.loginErr, redirectMessage });
    req.session.loginErr = null; // Clear login error after rendering
});

// GET signup page
router.get('/signup', (req, res) => {
    res.render('user/signup', { signupErr: req.session.signupErr });
    req.session.signupErr = null; // Clear the error after rendering
});

// POST signup
router.post('/signup', async (req, res) => {
    try {
        const userExists = await userHelpers.checkUserExists(req.body.email, req.body.name);
        if (userExists) {
            req.session.signupErr = 'Username or email already in use';
            return res.redirect('/signup');
        }
        await userHelpers.doSignup(req.body);
        res.redirect('/login');
    } catch (err) {
        console.error('Error during signup:', err);
        res.status(500).send('Error during signup'); 
    }
});

// POST login
router.post('/login', async (req, res) => {
    try {
        const response = await userHelpers.doLogin(req.body);
        if (response.status) {
            req.session.loggedIn = true;
            req.session.user = response.user;
            req.session.loginErr = null;
            res.redirect('/');
        } else {
            req.session.loginErr = 'Invalid username or password';
            res.redirect('/login');
        }
    } catch (err) {
        console.error('Error during login:', err);
        res.status(500).send('Error during login');
    }
});

// GET logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// GET cart page
router.get('/cart', verifyLogin, async (req, res) => {
    try {
        const products = await userHelpers.getCartProducts(req.session.user._id);
        const total = await userHelpers.getTotalAmount(req.session.user._id); // Total with discount applied
        res.render('user/cart', { products, total, user: req.session.user });
    } catch (err) {
        console.error('Error fetching cart products:', err);
        res.status(500).send('Error fetching cart products');
    }
});

// GET add-to-cart
router.get('/add-to-cart/:id', async (req, res) => {
    if (!req.session.loggedIn) {
        return res.json({ redirect: '/login' });
    }

    try {
        await userHelpers.addToCart(req.params.id, req.session.user._id);
        res.json({ success: true });
    } catch (err) {
        console.error('Error adding product to cart:', err);
        res.status(500).send('Error adding product to cart');
    }
});

// GET products by category
router.get('/category/:category?', async (req, res) => {
    const user = req.session.user;
    const category = req.params.category || null;

    try {
        const products = await productHelpers.getProductsByCategory(category);
        res.render('user/view-products', {
            products: products || [],
            user,
            home: true,
            selectedCategory: category || 'All Products',
        });
    } catch (err) {
        console.error('Error fetching products by category:', err);
        res.status(500).send('Error fetching products');
    }
});

// POST change product quantity
router.post('/change-product-quantity', async (req, res) => {
    try {
        const response = await userHelpers.changeProductQuantity(req.body);
        response.newQuantity = await userHelpers.getProductQuantity(req.body.userId, req.body.productId);
        res.json({ success: true, newQuantity: response.newQuantity });
    } catch (err) {
        console.error('Error changing product quantity:', err);
        res.status(500).json({ success: false });
    }
});

// POST remove product
router.post('/remove-product', async (req, res) => {
    try {
        await userHelpers.removeProductFromCart(req.body.userId, req.body.productId);
        res.json({ success: true });
    } catch (err) {
        console.error('Error removing product from cart:', err);
        res.status(500).json({ success: false });
    }
});

// GET place order page
router.get('/place-order', verifyLogin, async (req, res) => {
    try {
        const userId = req.session.user._id;
        const cartProducts = await userHelpers.getCartProducts(userId);

        if (cartProducts.length === 0) {
            return res.redirect('/cart');
        }

        const total = await userHelpers.getTotalAmount(userId); // Total with discount applied
        res.render('user/place-order', { total, user: req.session.user });
    } catch (err) {
        console.error('Error fetching place order page:', err);
        res.status(500).send('Error fetching place order page');
    }
});

// POST save address
router.post('/save-address', verifyLogin, async (req, res) => {
    try {
        const { phone } = req.body;

        // Validate phone number length
        if (!phone || phone.length !== 10 || isNaN(phone)) {
            return res.status(400).json({ success: false, message: 'Phone number must be exactly 10 digits.' });
        }

        const userId = req.session.user._id;
        const address = req.body;

        await db.get().collection(collection.ADDRESS_COLLECTION).updateOne(
            { user: new ObjectId(userId) },
            { $set: { address } },
            { upsert: true } // Create a new document if it doesn't exist
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Error saving address:', err);
        res.status(500).json({ success: false });
    }
});

// GET address
router.get('/get-address', verifyLogin, async (req, res) => {
    try {
        const userId = req.session.user._id;

        const userAddress = await db.get().collection(collection.ADDRESS_COLLECTION).findOne({ user: new ObjectId(userId) });

        res.json({ success: true, address: userAddress?.address || null });
    } catch (err) {
        console.error('Error fetching address:', err);
        res.status(500).json({ success: false });
    }
});

// POST place order with Razorpay integration
router.post('/place-order', verifyLogin, async (req, res) => {
    try {
        const userId = req.session.user._id;
        const paymentMethod = req.body.paymentMethod;

        const cartItems = await userHelpers.getCartProducts(userId);
        const subtotal = await userHelpers.getTotalAmount(userId);
        const shipping = 40; // Fixed shipping charge
        const totalAmount = subtotal + shipping;

        // Fetch the user's address
        const userAddress = await db.get().collection(collection.ADDRESS_COLLECTION).findOne({ user: new ObjectId(userId) });

        if (paymentMethod === 'online-payment') {
            // Create Razorpay order
            const options = {
                amount: totalAmount * 100, // Amount in paise
                currency: 'INR',
                receipt: `receipt_${Date.now()}`,
            };

            const razorpayOrder = await razorpay.orders.create(options);

            // Save the order details in the database with status "PENDING"
            const order = {
                userId: new ObjectId(userId),
                items: cartItems,
                subtotal,
                shipping,
                totalAmount,
                paymentMethod,
                address: userAddress?.address || {}, // Include the shipping address
                status: 'Failed',
                razorpayOrderId: razorpayOrder.id,
                createdAt: new Date(),
            };

            await db.get().collection(collection.ORDER_COLLECTION).insertOne(order);

            // Send Razorpay order details to the client
            return res.json({ success: true, razorpayOrderId: razorpayOrder.id, amount: totalAmount, key: process.env.RAZORPAY_KEY_ID });
        } else {
            // Handle Cash on Delivery
            const order = {
                userId: new ObjectId(userId),
                items: cartItems,
                subtotal,
                shipping,
                totalAmount,
                paymentMethod,
                address: userAddress?.address || {}, // Include the shipping address
                status: 'Ordered', // Changed from 'Arriving Soon' to 'Ordered'
                createdAt: new Date(),
            };

            await db.get().collection(collection.ORDER_COLLECTION).insertOne(order);
            await db.get().collection(collection.CART_COLLECTION).deleteOne({ user: new ObjectId(userId) });

            return res.json({ success: true, redirect: '/order-success' });
        }
    } catch (err) {
        console.error('Error placing order:', err);
        res.json({ success: false });
    }
});

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
            await db.get().collection(collection.ORDER_COLLECTION).updateOne(
                { razorpayOrderId },
                { $set: { status: 'FAILED' } }
            );

            return res.json({ success: false, message: 'Payment verification failed', redirect: '/place-order' });
        }
    } catch (err) {
        console.error('Error verifying payment:', err);
        res.status(500).json({ success: false, message: 'Internal server error', redirect: '/place-order' });
    }
});

// GET order success page
router.get('/order-success', verifyLogin, async (req, res) => {
    try {
        const userId = req.session.user._id;

        const latestOrder = await db.get().collection(collection.ORDER_COLLECTION).findOne(
            { userId: new ObjectId(userId) },
            { sort: { createdAt: -1 } }
        );

        if (!latestOrder) {
            return res.redirect('/orders');
        }

        const user = await db.get().collection(collection.USER_COLLECTION).findOne({ _id: new ObjectId(userId) });

        res.render('user/order-success', {
            user: { ...req.session.user, phone: latestOrder.address.phone }, // Include phone from address
            address: latestOrder.address, // Include address
            items: latestOrder.items,
            subtotal: latestOrder.totalAmount - 40,
            shipping: 40,
            total: latestOrder.totalAmount,
            orderId: latestOrder._id,
            paymentMethod: latestOrder.paymentMethod,
            orderDate: latestOrder.createdAt.toLocaleDateString()
        });
    } catch (err) {
        console.error('Error fetching order success details:', err);
        res.status(500).send('Error fetching order success details');
    }
});

// GET orders page
router.get('/orders', verifyLogin, async (req, res) => {
    try {
        const userId = req.session.user._id;
        const orders = await db.get().collection(collection.ORDER_COLLECTION).find({ userId: new ObjectId(userId) }).toArray();
        res.render('user/orders', { orders, user: req.session.user });
    } catch (err) {
        console.error('Error fetching orders:', err);
        res.status(500).send('Error fetching orders');
    }
});

// POST cancel order
router.post('/cancel-order', verifyLogin, async (req, res) => {
    try {
        const { orderId } = req.body;
        await db.get().collection(collection.ORDER_COLLECTION).updateOne(
            { _id: new ObjectId(orderId) },
            { $set: { status: 'Cancelled', remainingTime: 0 } } // Remove timer
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Error canceling order:', err);
        res.json({ success: false });
    }
});

// GET order details page
router.get('/order-details/:id', verifyLogin, async (req, res) => {
    try {
        const order = await db.get().collection(collection.ORDER_COLLECTION).findOne(
            { _id: new ObjectId(req.params.id) }
        );
        res.render('user/order-details', { 
            order: {
                ...order,
                createdAt: order.createdAt // Make sure createdAt is included
            }
        });
    } catch (err) {
        console.error('Error fetching order details:', err);
        res.status(500).send('Error fetching order details');
    }
});

// GET payment page
router.get('/payment', verifyLogin, (req, res) => {
    res.render('user/payment', { user: req.session.user });
});

// GET contact page
// Route for Contact Us page
router.get('/contact', (req, res) => {
    res.render('user/Contact', { user: req.session.user });
});

// Route for Terms and Conditions page
router.get('/terms-and-conditions', (req, res) => {
    res.render('user/terms-and-conditions', { user: req.session.user });
});

router.get('/reviews', async (req, res) => {
    try {
        const feedbacks = await db.get().collection(collection.FEEDBACK_COLLECTION).find().toArray();
        res.render('user/reviews', { feedbacks, user: req.session.user });
    } catch (err) {
        console.error('Error fetching feedback:', err);
        res.status(500).send('Error fetching feedback');
    }
});

// Protect the /feed route
router.get('/feed', verifyLogin, (req, res) => {
    res.render('user/feed', { user: req.session.user });
});

router.post('/submit-feedback', async (req, res) => {
    try {
        const feedback = {
            fullname: req.body.fullname,
            message: req.body.message,
            createdAt: new Date(),
        };
        await db.get().collection(collection.FEEDBACK_COLLECTION).insertOne(feedback);
        res.redirect('/reviews'); // Redirect to the reviews page after submission
    } catch (err) {
        console.error('Error submitting feedback:', err);
        res.status(500).send('Error submitting feedback');
    }
});

router.get('/terms-and-conditions', (req, res) => {
    res.render('user/terms-and-conditions', { user: req.session.user });
});

router.post('/update-delivery-status/:orderId', async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const { status, trackingStatus } = req.body;

        await db.get().collection(collection.ORDER_COLLECTION).updateOne(
            { _id: new ObjectId(orderId) },
            {
                $set: {
                    status: status,
                    'deliveryInfo.trackingStatus': trackingStatus
                }
            }
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Error updating delivery status:', err);
        res.status(500).json({ success: false });
    }
});

module.exports = router;

// Add FeedBack button