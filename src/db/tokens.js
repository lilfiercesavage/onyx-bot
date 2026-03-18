const db = require('./database');

const isTokenCalled = (tokenAddress) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM called_tokens WHERE token_address = ?', [tokenAddress], (err, row) => {
            if (err) return reject(err);
            resolve(!!row);
        });
    });
};

const markTokenCalled = (tokenAddress, pairAddress, signalScore) => {
    return new Promise((resolve, reject) => {
        db.run('INSERT INTO called_tokens (token_address, pair_address, signal_score) VALUES (?, ?, ?)', 
            [tokenAddress, pairAddress, signalScore], function(err) {
            if (err) return reject(err);
            resolve(this.changes > 0);
        });
    });
};

module.exports = { isTokenCalled, markTokenCalled };
