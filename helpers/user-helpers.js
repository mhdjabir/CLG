var db = require('../config/connection');
var collection = require('../config/collections');
const bcrypt = require('bcrypt');
const { ObjectId } = require('mongodb');
const { get } = require('../app');

module.exports = {
    doSignup: (userData) => {
        return new Promise(async (resolve, reject) => {
            userData.password = await bcrypt.hash(userData.password, 10);
            db.get().collection(collection.USER_COLLECTION).insertOne(userData).then((data) => {
                resolve(data.insertedId);
            }); 
        });  
    }, 
    doLogin: (userData) => {
        return new Promise(async (resolve, reject) => {
            let loginStatus = false;
            let response = {};
            let user = await db.get().collection(collection.USER_COLLECTION).findOne({ email: userData.email });
            if (user) {
                bcrypt.compare(userData.password, user.password).then((status) => {
                    if (status) {
                        console.log('Login Success');
                        response.user = user;
                        response.status = true;
                        resolve(response);
                    } else {
                        console.log('Login Failed: Incorrect password');
                        resolve({ status: false, message: 'Invalid email or password' });
                    }
                });
            } else {
                console.log('Login Failed: User not found');
                resolve({ status: false, message: 'Invalid email or password' });
            }
        });
    },
    addToCart: (prodId, userId) => {
        let proObj = {
            item: new ObjectId(prodId),
            quantity: 1
        };
        return new Promise(async (resolve, reject) => {
            let userCart = await db.get().collection(collection.CART_COLLECTION).findOne({ user: new ObjectId(userId) });
            if (userCart) {
                let proExist = userCart.products.findIndex(product => product.item == prodId);
                if (proExist != -1) {
                    db.get().collection(collection.CART_COLLECTION).updateOne({ user: new ObjectId(userId), 'products.item': new ObjectId(prodId) }, {
                        $inc: { 'products.$.quantity': 1 }
                    }).then(() => {
                        resolve();
                    });
                } else {
                    db.get().collection(collection.CART_COLLECTION).updateOne({ user: new ObjectId(userId) }, {
                        $push: { products: proObj }
                    }).then(() => {
                        resolve();
                    });
                }
            } else {
                let cartObj = {
                    user: new ObjectId(userId),
                    products: [proObj]
                };
                db.get().collection(collection.CART_COLLECTION).insertOne(cartObj).then((response) => {
                    resolve();
                });
            }
        });
    },
    getCartProducts: (userId) => {
    return new Promise(async (resolve, reject) => {
        let cartItems = await db.get().collection(collection.CART_COLLECTION).aggregate([
            {
                $match: { user: new ObjectId(userId) }
            },
            {
                $unwind: '$products'
            },
            {
                $lookup: {
                    from: collection.PRODUCT_COLLECTION,
                    localField: 'products.item',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            {
                $project: {
                    item: '$products.item',
                    quantity: '$products.quantity',
                    productDetails: { $arrayElemAt: ['$productDetails', 0] }
                }
            },
            {
                $project: {
                    item: 1,
                    quantity: 1,
                    productDetails: {
                        _id: '$productDetails._id',
                        name: '$productDetails.name',
                        price: '$productDetails.price',
                        weight: '$productDetails.weight', // Include weight here
                        image: '$productDetails.image'
                    }
                }
            }
        ]).toArray();
        resolve(cartItems || []);
    });
},
    changeProductQuantity: (data) => {
        return new Promise(async (resolve, reject) => {
            let cart = await db.get().collection(collection.CART_COLLECTION).findOne({ user: new ObjectId(data.userId) });
            let productIndex = cart.products.findIndex(product => product.item.toString() === data.productId);
    
            if (productIndex !== -1) {
                let newQuantity = cart.products[productIndex].quantity + parseInt(data.count);
                if (newQuantity <= 0) {
                    // Remove product if quantity is 0
                    cart.products.splice(productIndex, 1);
                } else {
                    // Update quantity
                    cart.products[productIndex].quantity = newQuantity;
                }
    
                await db.get().collection(collection.CART_COLLECTION).updateOne(
                    { user: new ObjectId(data.userId) },
                    { $set: { products: cart.products } }
                );
    
                resolve({ success: true });
            } else {
                reject('Product not found in cart');
            }
        });
    },
    removeProductFromCart: (userId, productId) => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.CART_COLLECTION).updateOne(
                { user: new ObjectId(userId) },
                { $pull: { products: { item: new ObjectId(productId) } } }
            ).then(() => {
                resolve();
            });
        });
    },
    getProductQuantity: (userId, productId) => {
        return new Promise(async (resolve, reject) => {
            try {
                const cart = await db.get().collection(collection.CART_COLLECTION).findOne({ user: new ObjectId(userId) });
                if (cart) {
                    const product = cart.products.find(product => product.item.toString() === productId);
                    resolve(product ? product.quantity : 0);
                } else {
                    resolve(0); // No cart found
                }
            } catch (err) {
                reject(err);
            }
        });
    },
    getTotalAmount: (userId) => {   
        return new Promise(async (resolve, reject) => {
            let total = await db.get().collection(collection.CART_COLLECTION).aggregate([
                {
                    $match: { user: new ObjectId(userId) }
                },
                {
                    $unwind: '$products'
                },
                {
                    $lookup: {
                        from: collection.PRODUCT_COLLECTION,
                        localField: 'products.item',
                        foreignField: '_id',
                        as: 'productDetails'
                    }
                },
                {
                    $project: {
                        quantity: '$products.quantity',
                        price: { $arrayElemAt: ['$productDetails.price', 0] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalAmount: { $sum: { $multiply: ['$quantity', { $toDouble: '$price' }] } }
                    }
                }
            ]).toArray();

            let totalAmount = total[0] ? total[0].totalAmount : 0;

            // Apply discount if total is greater than ₹1000
            if (totalAmount > 1000) {
                totalAmount -= 99;
            }

            resolve(totalAmount);
        });
    }
};

module.exports.checkUserExists = async (email, name) => {
    const user = await db.get().collection(collection.USER_COLLECTION).findOne({
        $or: [{ email: email }, { name: name }]
    });
    return !!user; // Return true if user exists, false otherwise
};