// filepath: /home/hozaifah/Desktop/github-lite/Github-lite/db.js
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

function readFallback() {
  if (!fs.existsSync(DATA_FILE)) return { repos: [] };
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return { repos: [] };
  }
}

function writeFallback(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

const config = {
  githubClientId: 'Ov23lic2nd965rKaETyK',
  githubClientSecret: 'f4ea29bc167310afdc1fb1c94c297abf342af90e',
  githubRedirectUri: 'http://localhost:3000/api/auth/github/callback', // must match your GitHub app settings
  jwtSecret: 'dev_secret_change_me'
};

// placeholder connect function (no MongoDB for now)
async function connect() {
  return null; // using fallback storage
}

module.exports = { connect, readFallback, writeFallback, config };
