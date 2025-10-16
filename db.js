const { MongoClient } = require('mongodb');
let db;

async function connectDb() {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    db = client.db('githubLite');
}

function getDb() {
    if (!db) throw new Error('Database not connected');
    return db;
}

module.exports = { connectDb, getDb };

