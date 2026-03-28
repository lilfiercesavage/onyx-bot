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
      initial_mcap REAL,
      ath_mcap REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      supply REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS active_tracking (
      token_address TEXT PRIMARY KEY,
      pair_address TEXT,
      signal_score REAL,
      initial_mcap REAL,
      initial_supply REAL,
      ath_mcap REAL DEFAULT 0,
      ath_high REAL DEFAULT 0,
      poll_interval INTEGER DEFAULT 30,
      last_poll DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_address TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      open REAL,
      high REAL,
      low REAL,
      close REAL,
      volume REAL,
      mcap REAL
    )`);
    
    db.all("PRAGMA table_info(called_tokens)", (err, cols) => {
      if (!err && cols) {
        const colNames = cols.map(c => c.name);
        if (!colNames.includes('ath_mcap')) {
          db.run(`ALTER TABLE called_tokens ADD COLUMN ath_mcap REAL DEFAULT 0`);
        }
        if (!colNames.includes('initial_mcap')) {
          db.run(`ALTER TABLE called_tokens ADD COLUMN initial_mcap REAL DEFAULT 0`);
        }
        if (!colNames.includes('supply')) {
          db.run(`ALTER TABLE called_tokens ADD COLUMN supply REAL DEFAULT 0`);
        }
        if (!colNames.includes('is_active')) {
          db.run(`ALTER TABLE called_tokens ADD COLUMN is_active INTEGER DEFAULT 1`);
        }
      }
    });
  }
});

module.exports = db;
