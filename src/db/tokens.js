const db = require('./database');

const isTokenCalled = (tokenAddress, cooldownHours = 24) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM called_tokens WHERE token_address = ? AND created_at > datetime("now", ?)', 
            [tokenAddress, `-${cooldownHours} hours`], (err, row) => {
            if (err) return reject(err);
            resolve(!!row);
        });
    });
};

const markTokenCalled = (tokenAddress, pairAddress, signalScore, initialMcap, supply = 0) => {
    return new Promise((resolve, reject) => {
        db.run(`INSERT OR REPLACE INTO called_tokens 
            (token_address, pair_address, signal_score, initial_mcap, ath_mcap, supply, is_active) 
            VALUES (?, ?, ?, ?, 0, ?, 1)`, 
            [tokenAddress, pairAddress, signalScore, initialMcap, supply], function(err) {
            if (err) return reject(err);
            resolve(this.changes > 0);
        });
    });
};

const updateAthMcap = (tokenAddress, currentMcap) => {
    return new Promise((resolve, reject) => {
        db.run('UPDATE called_tokens SET ath_mcap = MAX(ath_mcap, ?) WHERE LOWER(token_address) = LOWER(?)', 
            [currentMcap, tokenAddress], function(err) {
            if (err) return reject(err);
            resolve(this.changes > 0);
        });
    });
};

const getLeaderboard = () => {
    return new Promise((resolve, reject) => {
        db.all('SELECT token_address, pair_address, signal_score, initial_mcap, ath_mcap, created_at, supply, is_active FROM called_tokens ORDER BY created_at DESC LIMIT 50', (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
};

const getHallOfFame = () => {
    return new Promise((resolve, reject) => {
        db.all('SELECT token_address, pair_address, signal_score, initial_mcap, ath_mcap, created_at FROM called_tokens WHERE initial_mcap > 0 AND ath_mcap > initial_mcap * 5 ORDER BY (ath_mcap / initial_mcap) DESC LIMIT 20', (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
};

const addToActiveTracking = (tokenAddress, pairAddress, signalScore, initialMcap, supply) => {
    return new Promise((resolve, reject) => {
        db.run(`INSERT OR REPLACE INTO active_tracking 
            (token_address, pair_address, signal_score, initial_mcap, initial_supply, poll_interval, last_poll) 
            VALUES (?, ?, ?, ?, ?, 30, datetime('now'))`, 
            [tokenAddress, pairAddress, signalScore, initialMcap, supply], function(err) {
            if (err) return reject(err);
            resolve(this.changes > 0);
        });
    });
};

const getActiveTrackingTokens = () => {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM active_tracking ORDER BY signal_score DESC', (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
};

const updateActiveTracking = (tokenAddress, currentMcap, currentHigh, supply) => {
    return new Promise((resolve, reject) => {
        db.run(`UPDATE active_tracking 
            SET ath_mcap = MAX(ath_mcap, ?), 
                ath_high = MAX(ath_high, ?),
                supply = COALESCE(?, supply),
                last_poll = datetime('now')
            WHERE LOWER(token_address) = LOWER(?)`, 
            [currentMcap, currentHigh, supply, tokenAddress], function(err) {
            if (err) return reject(err);
            resolve(this.changes > 0);
        });
    });
};

const removeFromActiveTracking = (tokenAddress) => {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM active_tracking WHERE LOWER(token_address) = LOWER(?)', [tokenAddress], function(err) {
            if (err) return reject(err);
            resolve(this.changes > 0);
        });
    });
};

const adjustPollInterval = (tokenAddress, multiplier) => {
    return new Promise((resolve, reject) => {
        db.run('UPDATE active_tracking SET poll_interval = MAX(10, MIN(300, poll_interval * ?)) WHERE LOWER(token_address) = LOWER(?)', 
            [multiplier, tokenAddress], function(err) {
            if (err) return reject(err);
            resolve(this.changes > 0);
        });
    });
};

const recordPriceHistory = (tokenAddress, open, high, low, close, volume, mcap) => {
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO price_history (token_address, open, high, low, close, volume, mcap) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [tokenAddress, open, high, low, close, volume, mcap], function(err) {
            if (err) return reject(err);
            resolve(this.lastID);
        });
    });
};

const getPriceHistory = (tokenAddress, limit = 60) => {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM price_history WHERE token_address = ? ORDER BY timestamp DESC LIMIT ?', 
            [tokenAddress, limit], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
};

const getSupply = (tokenAddress) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT supply FROM called_tokens WHERE LOWER(token_address) = LOWER(?)', [tokenAddress], (err, row) => {
            if (err) return reject(err);
            resolve(row?.supply || 0);
        });
    });
};

module.exports = { 
    isTokenCalled, 
    markTokenCalled, 
    updateAthMcap, 
    getLeaderboard, 
    getHallOfFame,
    addToActiveTracking,
    getActiveTrackingTokens,
    updateActiveTracking,
    removeFromActiveTracking,
    adjustPollInterval,
    recordPriceHistory,
    getPriceHistory,
    getSupply
};