require('dotenv').config();
const express = require('express');
const path = require('path');
const cron = require('node-cron');
const axios = require('axios');
const { bot, broadcastGems } = require('./src/bot/bot');
const { scanForGems } = require('./src/core/scanner');
const dbUsers = require('./src/db/users');
const dbTokens = require('./src/db/tokens');

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

let recentGems = [];

app.get('/api/ping', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/status/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        
        let access = await dbUsers.checkAccess(userId);
        
        if (!access.hasAccess && access.reason === 'Not registered') {
            access = await dbUsers.checkAccess(userId);
        }
        
        res.json({
            hasAccess: access.hasAccess,
            status: access.status,
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
        const calledTokens = await dbTokens.getLeaderboard();
        
        if (calledTokens.length === 0) {
            return res.json({ leaderboard: [] });
        }

        const addresses = calledTokens.map(t => t.token_address).join(',');
        
        let currentData = {};
        try {
            const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${addresses}`);
            if (response.data?.pairs) {
                for (const pair of response.data.pairs) {
                    currentData[pair.baseToken.address.toLowerCase()] = pair.fdv || 0;
                }
            }
        } catch (e) {
            console.error('Failed to fetch current prices:', e.message);
        }

        const leaderboard = calledTokens.map(token => {
            const currentMcap = currentData[token.token_address.toLowerCase()] || 0;
            const initialMcap = token.initial_mcap || 1;
            const multiplier = initialMcap > 0 ? currentMcap / initialMcap : 1;
            
            return {
                address: token.token_address,
                initialMcap: initialMcap,
                currentMcap: currentMcap,
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Alpha Terminal running on port ${PORT}`);
});

(async () => {
    try {
        const me = await bot.telegram.getMe();
        console.log(`Bot connected to Telegram as @${me.username}`);
        
        await bot.launch();
        console.log("Telegram Bot started successfully via polling.");
    } catch (err) {
        console.error("Failed to start Telegram Bot:", err.message);
        if (err.message.includes("409")) {
            console.error("CRITICAL: Another instance of this bot is already running elsewhere.");
        }
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
    try {
        const gems = await scanForGems();
        recentGems = [...gems, ...recentGems].slice(0, 20);
        if (gems.length > 0) {
            await broadcastGems(gems);
        }
    } catch (error) {
        console.error("Error during scheduled scanner run:", error.message);
    }
});

console.log("Scanner Job Scheduled (runs every 5 minutes).");