// db.js
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const CONFIG_FILE = path.join(__dirname, 'config.json');
let config = {};
try {
  if (fs.existsSync(CONFIG_FILE)) {
    config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  }
} catch(e) {
  console.warn('Could not read config file', e);
}

// ---- MongoDB connection ----
let dbClient = null;
let dbInstance = null;

async function connect() {
  if (dbInstance) return dbInstance;
  if (!config.mongoUri) {
    console.warn('Mongo URI not provided. Using fallback storage.');
    return null;
  }
  try {
    dbClient = new MongoClient(config.mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
    await dbClient.connect();
    dbInstance = dbClient.db(config.mongoDbName || 'github-lite');
    console.log('Connected to MongoDB');
    return dbInstance;
  } catch(e) {
    console.error('MongoDB connection failed:', e);
    return null;
  }
}

// ---- fallback storage ----
const FALLBACK_FILE = path.join(__dirname, 'fallback.json');

function readFallback() {
  try {
    if (!fs.existsSync(FALLBACK_FILE)) return {};
    return JSON.parse(fs.readFileSync(FALLBACK_FILE, 'utf-8'));
  } catch(e) {
    console.error('Error reading fallback storage:', e);
    return {};
  }
}

function writeFallback(obj) {
  try {
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch(e) {
    console.error('Error writing fallback storage:', e);
  }
}

module.exports = {
  connect,
  readFallback,
  writeFallback,
  config
};
