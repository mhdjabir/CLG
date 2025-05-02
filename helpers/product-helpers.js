var db = require('../config/connection')
var collection = require('../config/collections')   
const { ObjectId } = require('mongodb'); 
const { get } = require('../app');
module.exports = {
    addProduct: (product) => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.PRODUCT_COLLECTION).insertOne(product)
                .then((data) => {
                    resolve(data); 
                })
                .catch((err) => {
                    console.error(err);
                    reject(err);  
                });
        });
    },
    getAllproducts:() => {
        return new Promise(async(resolve,reject)=>{
            let products = await db.get().collection(collection.PRODUCT_COLLECTION).find().toArray()
            resolve(products)
        })
    },
    deleteProduct: (prodId) => {
        return new Promise((resolve, reject) => {
            try {
                const objectId = new ObjectId(prodId); 
                db.get().collection(collection.PRODUCT_COLLECTION).deleteOne({ _id: objectId })
                    .then((response) => {
                        resolve(response);
                    })
                    .catch((err) => {
                        reject(err);
                    });
            } catch (err) {
                console.error('Invalid ObjectId:', err);
                reject(err); 
            }
        });
    },
    getProductsByCategory: (category) => {
        return new Promise(async (resolve, reject) => {
            try {
                let query = {};
                if (category) {
                    query.category = category; 
                }
                let products = await db.get().collection(collection.PRODUCT_COLLECTION).find(query).toArray();
                console.log('Query:', query);
                console.log('Products:', products);
                resolve(products);
            } catch (err) {
                reject(err);
            }
        });
    },
    searchProducts: (query) => {
        return new Promise(async (resolve, reject) => {
            try {
                const products = await db.get().collection(collection.PRODUCT_COLLECTION).find({
                    name: { $regex: query, $options: 'i' } // Case-insensitive search
                }).toArray();
                resolve(products);
            } catch (err) {
                console.error('Error searching products:', err);
                reject(err);
            }
        });
    },
    getProductsPaginated: (page, limit) => {
        return new Promise(async (resolve, reject) => {
            try {
                const skip = (page - 1) * limit;
                
                const products = await db.get()
                    .collection(collection.PRODUCT_COLLECTION)
                    .find()
                    .skip(skip)
                    .limit(limit)
                    .toArray();

                resolve(products);
            } catch (err) {
                console.error('Error fetching paginated products:', err);
                reject(err);
            }
        });
    },
    
};