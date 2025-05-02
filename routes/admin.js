var express = require('express');
var router = express.Router();
var db = require('../config/connection'); // Import database connection
var collection = require('../config/collections'); // Import collections
var productHelpers = require('../helpers/product-helpers');
const { ObjectId } = require('mongodb'); // Import ObjectId for MongoDB operations
const sharp = require('sharp');

router.get('/', function(req, res, next) {
    productHelpers.getAllproducts().then((products) => {
        console.log(products); 
        res.render('admin/view-products', { admin: true, products });
  
    })
       
});  

router.get('/add-product', function(req, res) {
    res.render('admin/add-product', { admin: true });
}); 

router.post('/add-product', function(req, res) {
    console.log(req.body);
    console.log(req.files?.image);
 
    // Add category to the product data
    const productData = {
        ...req.body,
        category: req.body.category // Assuming the form includes a 'category' field
    };

    productHelpers.addProduct(productData).then((result) => {
        if (result.insertedId) {
            let image = req.files?.image;
            if (image) {
                sharp(image.data)
                    .resize(800, 800, { // Resize to reasonable dimensions
                        fit: 'cover',
                        withoutEnlargement: true
                    })
                    .jpeg({ quality: 80 }) // Compress JPEG
                    .toFile('./public/product-images/' + result.insertedId + '.jpg')
                    .then(() => {
                        res.redirect('/admin');
                    })
                    .catch(err => {
                        console.error('Error processing image:', err);
                        res.status(500).send('Error processing image');
                    });
            } else {
                res.status(400).send('Image not provided');
            }
        } else {
            console.log('Failed to add product');
            res.status(500).send('Failed to add product');
        }
    }).catch((err) => {
        console.error(err);
        res.status(500).send('Error adding product');
    });
});

router.get('/delete-product/:id', function(req, res) {
    let prodId = req.params.id;
    productHelpers.deleteProduct(prodId).then((response) => {
        res.redirect('/admin/');
    });
});

router.get('/category/:category', function(req, res) {
    let category = req.params.category;
    productHelpers.getProductsByCategory(category).then((products) => {
        res.render('admin/view-products', { admin: true, products });
    }).catch((err) => {
        console.error(err);
        res.status(500).send('Error fetching products by category');
    });
});

router.get('/search', function(req, res) {
    const query = req.query.query; // Get the search query from the URL
    productHelpers.searchProducts(query).then((filteredProducts) => {
        res.render('admin/view-products', { admin: true, products: filteredProducts });
    }).catch((err) => {
        console.error(err);
        res.status(500).send('Error searching products');
    });
});

// Render edit product page
router.get('/edit-product/:id', async (req, res) => {
    const prodId = req.params.id;
    try {
        const product = await db.get().collection(collection.PRODUCT_COLLECTION).findOne({ _id: new ObjectId(prodId) });
        res.render('admin/edit-product', { admin: true, product });
    } catch (err) {
        console.error('Error fetching product for editing:', err);
        res.status(500).send('Error fetching product');
    }
});

// Handle edit product form submission
router.post('/edit-product/:id', async (req, res) => {
    const prodId = req.params.id;
    const updatedData = req.body;

    try {
        await db.get().collection(collection.PRODUCT_COLLECTION).updateOne(
            { _id: new ObjectId(prodId) },
            { $set: updatedData }
        );

        if (req.files?.image) {
            const image = req.files.image;
            image.mv('./public/product-images/' + prodId + '.jpg', (err) => {
                if (err) {
                    console.error('Error uploading image:', err);
                }
            });
        }

        res.redirect('/admin');
    } catch (err) {
        console.error('Error updating product:', err);
        res.status(500).send('Error updating product');
    }
});

// Route to fetch all users
router.get('/users', async (req, res) => {
    try {
        const users = await db.get().collection(collection.USER_COLLECTION).find().toArray();
        res.render('admin/view-users', { admin: true, users });
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).send('Error fetching users');
    }
});

router.post('/remove-user/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        await db.get().collection(collection.USER_COLLECTION).deleteOne({ _id: new ObjectId(userId) });
        res.redirect('/admin/users');
    } catch (err) {
        console.error('Error removing user:', err);
        res.status(500).send('Error removing user');
    }
});

router.get('/orders', async (req, res) => {
    try {
        const orders = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
            {
                $lookup: {
                    from: collection.USER_COLLECTION,
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'userDetails'
                }
            },
            {
                $project: {
                    _id: 1,
                    totalAmount: 1,
                    status: 1,
                    user: { $arrayElemAt: ['$userDetails', 0] } // Extract the first user object
                }
            }
        ]).toArray();
        res.render('admin/view-orders', { admin: true, orders });
    } catch (err) {
        console.error('Error fetching orders:', err);
        res.status(500).send('Error fetching orders');
    }
});

router.get('/order-details/:id', async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
            { $match: { _id: new ObjectId(orderId) } },
            {
                $lookup: {
                    from: collection.USER_COLLECTION,
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'userDetails'
                }
            },
            {
                $project: {
                    _id: 1,
                    items: 1,
                    totalAmount: 1,
                    status: 1,
                    createdAt: 1, // Make sure to include this
                    user: { $arrayElemAt: ['$userDetails', 0] }
                }
            }
        ]).toArray();

        if (!order[0]) {
            return res.status(404).send('Order not found');
        }

        res.render('admin/order-details', { 
            admin: true, 
            order: order[0]
        });
    } catch (err) {
        console.error('Error fetching order details:', err);
        res.status(500).send('Error fetching order details');
    }
});

router.post('/assign-delivery/:orderId', async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const { partnerName, partnerPhone, vehicleNumber, expectedDelivery } = req.body;

        await db.get().collection(collection.ORDER_COLLECTION).updateOne(
            { _id: new ObjectId(orderId) },
            {
                $set: {
                    deliveryInfo: {
                        partnerName,
                        partnerPhone,
                        vehicleNumber,
                        expectedDelivery,
                        assignedAt: new Date(),
                        trackingStatus: 'Picked up by delivery partner'
                    },
                    status: 'Out for Delivery'
                }
            }
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Error assigning delivery partner:', err);
        res.status(500).json({ success: false });
    }
});

module.exports = router;