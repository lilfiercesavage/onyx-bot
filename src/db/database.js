const sqlite3 = require('sqlite3');
const path = require('path');
const dbPath = path.resolve(__dirname, '../../database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to SQLite database.');
    db.run(`CREATE TABLE IF NOT EXISTS users (
      telegram_id INTEGER PRIMARY KEY,
      status TEXT,
      trial_start DATETIME,
      sub_expiry DATETIME
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS called_tokens (
      token_address TEXT PRIMARY KEY,
      pair_address TEXT,
      signal_score REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  }
});

module.exports = db;
