const db = require('./database');

// Give user 14 days trial by default
const activateTrial = (telegramId) => {
  return new Promise((resolve, reject) => {
    const trialStart = new Date();
    const expiry = new Date();
    expiry.setDate(trialStart.getDate() + 14);

    const stmt = db.prepare(`
      INSERT INTO users (telegram_id, status, trial_start, sub_expiry) 
      VALUES (?, 'trial', ?, ?)
      ON CONFLICT(telegram_id) DO NOTHING
    `);

    stmt.run([telegramId, trialStart.toISOString(), expiry.toISOString()], function (err) {
      if (err) reject(err);
      else resolve({ newTrialSetup: this.changes > 0 });
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

module.exports = { activateTrial, checkAccess, getActiveUsers };
