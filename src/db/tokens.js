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

const markTokenCalled = (tokenAddress, pairAddress, signalScore, initialMcap) => {
    return new Promise((resolve, reject) => {
        db.run('INSERT INTO called_tokens (token_address, pair_address, signal_score, initial_mcap, ath_mcap) VALUES (?, ?, ?, ?, ?)', 
            [tokenAddress, pairAddress, signalScore, initialMcap, 0], function(err) {
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
        db.all('SELECT token_address, pair_address, signal_score, initial_mcap, ath_mcap, created_at FROM called_tokens ORDER BY created_at DESC LIMIT 50', (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
};

module.exports = { isTokenCalled, markTokenCalled, updateAthMcap, getLeaderboard };
