require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cron = require('node-cron');
const axios = require('axios');
const { bot, broadcastGems } = require('./src/bot/bot');
const { scanForGems } = require('./src/core/scanner');
const dbUsers = require('./src/db/users');
const dbTokens = require('./src/db/tokens');
const { fetchDexScreenerCandles, fetchTrueMarketCap, getSpikeMetrics } = require('./src/services/ohlcv');

const PORT = process.env.PORT || 3000;
const DOMAIN = (process.env.RENDER_EXTERNAL_URL || process.env.DOMAIN || 'https://your-app.onrender.com')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');

if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.warn("WARNING: TELEGRAM_BOT_TOKEN is not set. Bot will fail to start.");
}

if (!process.env.GROQ_API_KEY) {
    console.warn("WARNING: GROQ_API_KEY is not set. AI Summaries will fallback to default text.");
}

console.log("Starting DeFi Intelligence Layer Bot...");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const secretPath = crypto.randomBytes(32).toString('hex');
console.log(`Webhook secret path: /${secretPath}`);

let recentGems = [];
let scanInProgress = false;

app.get('/api/ping', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), scanRunning: scanInProgress, gems: recentGems.length });
});

app.get('/api/status/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        
        await dbUsers.activateUser(userId);
        let access = await dbUsers.checkAccess(userId);
        
        res.json({
            hasAccess: true,
            status: 'active',
            reason: access.reason,
            expiry: access.expiry,
            gemsFound: recentGems.length
        });
    } catch (err) {
        res.json({ hasAccess: false, reason: 'Error checking status', gemsFound: recentGems.length });
    }
});

app.get('/api/gems', async (req, res) => {
    res.json(recentGems.map(gem => ({
        symbol: gem.baseToken?.symbol,
        chain: gem.chainId,
        marketCap: gem.fdv,
        liquidity: gem.liquidity?.usd,
        volume: gem.volume?.h1,
        signalScore: gem.signalScore,
        address: gem.baseToken?.address
    })));
});

app.get('/api/leaderboard', async (req, res) => {
    try {
        let calledTokens = await dbTokens.getLeaderboard();
        
        if (calledTokens.length === 0) {
            return res.json({ leaderboard: [] });
        }

        const addresses = calledTokens.map(t => t.token_address).join(',');
        
        try {
            const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${addresses}`);
            if (response.data?.pairs) {
                for (const pair of response.data.pairs) {
                    const addr = pair.baseToken.address.toLowerCase();
                    const currentMcap = pair.fdv || 0;
                    await dbTokens.updateAthMcap(addr, currentMcap);
                }
            }
        } catch (e) {
            console.error('Failed to fetch current prices:', e.message);
        }

        calledTokens = await dbTokens.getLeaderboard();

        const leaderboard = calledTokens.map(token => {
            const athMcap = token.ath_mcap || 0;
            const initialMcap = token.initial_mcap || 0;
            const multiplier = initialMcap > 0 && athMcap > initialMcap ? athMcap / initialMcap : 1;
            
            return {
                address: token.token_address,
                initialMcap: initialMcap,
                athMcap: athMcap,
                multiplier: multiplier,
                signalScore: token.signal_score,
                calledAt: token.created_at
            };
        }).sort((a, b) => {
            if (b.multiplier !== a.multiplier) return b.multiplier - a.multiplier;
            return b.signalScore - a.signalScore;
        });

        res.json({ leaderboard });
    } catch (err) {
        console.error('Leaderboard error:', err.message);
        res.json({ leaderboard: [], error: err.message });
    }
});

app.get('/api/hall-of-fame', async (req, res) => {
    try {
        let calledTokens = await dbTokens.getHallOfFame();
        
        if (calledTokens.length === 0) {
            return res.json({ hallOfFame: [] });
        }

        const addresses = calledTokens.map(t => t.token_address).join(',');
        
        try {
            const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${addresses}`);
            if (response.data?.pairs) {
                for (const pair of response.data.pairs) {
                    const addr = pair.baseToken.address.toLowerCase();
                    const currentMcap = pair.fdv || 0;
                    await dbTokens.updateAthMcap(addr, currentMcap);
                }
            }
        } catch (e) {
            console.error('Failed to fetch current prices:', e.message);
        }

        calledTokens = await dbTokens.getHallOfFame();

        const hallOfFame = calledTokens.map(token => {
            const athMcap = token.ath_mcap || 0;
            const initialMcap = token.initial_mcap || 0;
            const multiplier = initialMcap > 0 ? athMcap / initialMcap : 0;
            
            return {
                address: token.token_address,
                initialMcap: initialMcap,
                athMcap: athMcap,
                multiplier: multiplier,
                signalScore: token.signal_score,
                calledAt: token.created_at
            };
        }).sort((a, b) => {
            if (b.multiplier !== a.multiplier) return b.multiplier - a.multiplier;
            return b.signalScore - a.signalScore;
        });

        res.json({ hallOfFame });
    } catch (err) {
        console.error('Hall of Fame error:', err.message);
        res.json({ hallOfFame: [], error: err.message });
    }
});

app.get('/api/active-tracking', async (req, res) => {
    try {
        const activeTokens = await dbTokens.getActiveTrackingTokens();
        
        const tracking = activeTokens.map(token => ({
            address: token.token_address,
            pairAddress: token.pair_address,
            initialMcap: token.initial_mcap,
            currentAthMcap: token.ath_mcap,
            currentHigh: token.ath_high,
            pollInterval: token.poll_interval,
            signalScore: token.signal_score,
            calledAt: token.created_at,
            multiplier: token.initial_mcap > 0 ? (token.ath_mcap / token.initial_mcap).toFixed(2) : '0.00'
        }));
        
        res.json({ activeTracking: tracking });
    } catch (err) {
        res.json({ activeTracking: [], error: err.message });
    }
});

app.get('/terminal', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Alpha Terminal running on port ${PORT}`);
});

(async () => {
    try {
        const me = await bot.telegram.getMe();
        console.log(`Bot connected to Telegram as @${me.username}`);
        
        await bot.telegram.setWebhook(`https://${DOMAIN}/${secretPath}`);
        console.log(`Webhook set to: https://${DOMAIN}/${secretPath}`);
        
        app.use(`/${secretPath}`, (req, res, next) => {
            if (req.method !== 'POST') {
                return res.send('OK');
            }
            bot.handleUpdate(req.body, res);
        });
        
        console.log("Telegram Bot started successfully via webhook.");
    } catch (err) {
        console.error("Failed to start Telegram Bot:", err.message);
    }
})();

(async () => {
    try {
        console.log("Performing initial scan...");
        const gems = await scanForGems();
        recentGems = gems;
        if (gems.length > 0) {
            console.log(`Initial scan found ${gems.length} gems. Broadcasting...`);
            await broadcastGems(gems);
        } else {
            console.log("Initial scan completed. No gems found.");
        }
    } catch (error) {
        console.error("Initial scan failed:", error.message);
    }
})();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

cron.schedule('*/5 * * * *', async () => {
    if (scanInProgress) {
        console.log('Scan already in progress, skipping...');
        return;
    }
    
    scanInProgress = true;
    try {
        console.log(`[${new Date().toISOString()}] Starting scheduled scan...`);
        
        await updateAllAth();
        
        const gems = await scanForGems();
        recentGems = [...gems, ...recentGems].slice(0, 20);
        if (gems.length > 0) {
            console.log(`Found ${gems.length} new gems, broadcasting...`);
            await broadcastGems(gems);
        } else {
            console.log(`Scheduled scan complete. No new gems.`);
        }
    } catch (error) {
        console.error("Error during scheduled scanner run:", error.message);
    } finally {
        scanInProgress = false;
    }
});

const updateAllAth = async () => {
    try {
        const calledTokens = await dbTokens.getLeaderboard();
        if (calledTokens.length === 0) return;
        
        const addresses = calledTokens.map(t => t.token_address).join(',');
        const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${addresses}`);
        
        if (response.data?.pairs) {
            for (const pair of response.data.pairs) {
                const addr = pair.baseToken.address.toLowerCase();
                const currentMcap = pair.fdv || 0;
                await dbTokens.updateAthMcap(addr, currentMcap);
            }
            console.log(`Updated ATH for ${response.data.pairs.length} tokens`);
        }
    } catch (e) {
        console.error('Failed to update ATH:', e.message);
    }
};

console.log("Scanner Job Scheduled (runs every 5 minutes).");

const trackActiveGems = async () => {
    try {
        const activeTokens = await dbTokens.getActiveTrackingTokens();
        
        if (activeTokens.length === 0) {
            console.log('[ActiveTracker] No active gems to track');
            return;
        }
        
        console.log(`[ActiveTracker] Tracking ${activeTokens.length} gems...`);
        
        for (const token of activeTokens) {
            try {
                const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${token.token_address}`);
                
                if (response.data?.pairs?.[0]) {
                    const pair = response.data.pairs[0];
                    const currentMcap = pair.fdv || 0;
                    const currentPrice = pair.priceUsd || 0;
                    
                    let spikeHigh = currentMcap;
                    
                    const candles = await fetchDexScreenerCandles(token.pair_address);
                    if (candles && candles.length > 0) {
                        const metrics = getSpikeMetrics(candles);
                        if (metrics) {
                            const candleHighMcap = currentMcap * (metrics.periodHigh / metrics.open);
                            spikeHigh = Math.max(currentMcap, candleHighMcap);
                            console.log(`[${token.token_address.slice(0,8)}...] Spike detected: ${metrics.spikePercent}% high`);
                        }
                        
                        const lastCandle = candles[candles.length - 1];
                        await dbTokens.recordPriceHistory(
                            token.token_address,
                            lastCandle.open,
                            lastCandle.high,
                            lastCandle.low,
                            lastCandle.close,
                            lastCandle.volume,
                            currentMcap
                        );
                    }
                    
                    const supplyData = await fetchTrueMarketCap(token.token_address, currentPrice, pair.chainId);
                    if (supplyData.trueMcap > 0) {
                        spikeHigh = Math.max(spikeHigh, supplyData.trueMcap);
                    }
                    
                    await dbTokens.updateActiveTracking(token.token_address, spikeHigh, spikeHigh, supplyData.supply);
                    await dbTokens.updateAthMcap(token.token_address, spikeHigh);
                    
                    if (spikeHigh > token.ath_mcap * 1.5) {
                        console.log(`[ALERT] ${token.token_address.slice(0,8)}... jumped ${(spikeHigh/token.ath_mcap).toFixed(2)}x!`);
                    }
                }
            } catch (e) {
                console.error(`[ActiveTracker] Error tracking ${token.token_address.slice(0,8)}: ${e.message}`);
            }
        }
    } catch (err) {
        console.error('[ActiveTracker] Error:', err.message);
    }
};

setInterval(trackActiveGems, 30000);
console.log("Active Tracker Job Scheduled (runs every 30 seconds).");