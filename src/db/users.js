const db = require('./database');

const activateUser = (telegramId) => {
  return new Promise((resolve, reject) => {
    const now = new Date();
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 10);

    db.run(`INSERT OR REPLACE INTO users (telegram_id, status, trial_start, sub_expiry) VALUES (?, 'active', ?, ?)`,
      [telegramId, now.toISOString(), expiry.toISOString()],
      function(err) {
        if (err) reject(err);
        else resolve({ newUserSetup: true });
      });
  });
};

const checkAccess = (telegramId) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT status, sub_expiry FROM users WHERE telegram_id = ?`, [telegramId], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve({ hasAccess: false, reason: 'Not registered' });

      const now = new Date();
      const expiry = new Date(row.sub_expiry);
      if (now > expiry) {
        // Automatically block them and update status if needed
        db.run(`UPDATE users SET status = 'expired' WHERE telegram_id = ?`, [telegramId]);
        return resolve({ hasAccess: false, reason: 'Subscription expired' });
      }

      resolve({ hasAccess: true, status: row.status });
    });
  });
};

const getActiveUsers = () => {
    return new Promise((resolve, reject) => {
        const now = new Date().toISOString();
        db.all(`SELECT telegram_id FROM users WHERE sub_expiry > ?`, [now], (err, rows) => {
            if (err) return reject(err);
            resolve(rows.map(row => row.telegram_id));
        });
    });
};

module.exports = { activateUser, checkAccess, getActiveUsers };
