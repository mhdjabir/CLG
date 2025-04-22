const { MongoClient } = require('mongodb');

let state = {
    db: null
}; 

module.exports.connect = function(done) {
    const url = 'mongodb://localhost:27017';
    const dbName = 'shopping';

    MongoClient.connect(url)
        .then((client) => {
            console.log('Connected to MongoDB');
            state.db = client.db(dbName); 
            done();
        })
        .catch((err) => {
            console.log(err);
            done(err); 
        });
}

module.exports.get = function() {
    return state.db;
};
