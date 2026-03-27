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
            const multiplier = initialMcap > 0 && athMcap > 0 ? athMcap / initialMcap : 1;
            
            return {
                address: token.token_address,
                initialMcap: initialMcap,
                athMcap: athMcap,
                multiplier: multiplier,
                signalScore: token.signal_score,
                calledAt: token.created_at
            };
        }).sort((a, b) => b.multiplier - a.multiplier);

        res.json({ leaderboard });
    } catch (err) {
        console.error('Leaderboard error:', err.message);
        res.json({ leaderboard: [], error: err.message });
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

console.log("Scanner Job Scheduled (runs every 5 minutes).");