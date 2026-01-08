const mongoose = require('mongoose');
require('dotenv').config({ path: ['../.env', '.env'] });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/dsl_engine';

async function connectMongo() {
    try {
        const conn = await mongoose.connect(MONGO_URI);
        console.log(`[Mongo] Connected to ${conn.connection.host}`);
    } catch (err) {
        console.error('[Mongo] Connection error:', err);
        process.exit(1); // Fail fast if storage is down
    }
}

mongoose.connection.on('error', err => {
    console.error('[Mongo] Runtime error:', err);
});

module.exports = { connectMongo };
