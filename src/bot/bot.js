const { Telegraf } = require('telegraf');
const dbUsers = require('../db/users');
require('dotenv').config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.start(async (ctx) => {
    try {
        const userId = ctx.from.id;
        const result = await dbUsers.activateTrial(userId);
        
        if (result.newTrialSetup) {
            ctx.reply("Welcome to DeFi Intelligence Layer! 🚀\nYour 14-day Free Alpha trial has started. You will receive High-Potential Gems as they are discovered.");
        } else {
            const access = await dbUsers.checkAccess(userId);
            if (access.hasAccess) {
                ctx.reply("Welcome back! Your subscription is currently active.");
            } else {
                ctx.reply("Your subscription has expired. Please type /upgrade to renew.");
            }
        }
    } catch (err) {
        console.error("Bot Start Error:", err);
        ctx.reply("An error occurred during account setup.");
    }
});

bot.command('status', async (ctx) => {
    try {
        const userId = ctx.from.id;
        const access = await dbUsers.checkAccess(userId);
        
        if (access.hasAccess) {
            ctx.reply(`Status: Active ✅\nType: ${access.status.toUpperCase()}`);
        } else {
            ctx.reply(`Status: Inactive ❌\nReason: ${access.reason}\nType /upgrade to get access.`);
        }
    } catch (err) {
        ctx.reply("Could not retrieve status.");
    }
});

bot.command('upgrade', (ctx) => {
    ctx.reply("To upgrade to the $150/mo B2B subscription, please visit: https://example.com/pay (Replace with actual payment link)");
});

bot.command('terminal', (ctx) => {
    const webAppUrl = process.env.WEB_APP_URL || 'https://your-domain.com/terminal';
    ctx.reply('🔮 Open Alpha Terminal to view your dashboard:', {
        reply_markup: {
            web_app: { url: webAppUrl }
        }
    });
});

// Broadcast Gems to active subscribers
const broadcastGems = async (gems) => {
    if (gems.length === 0) return;

    try {
        const activeUsers = await dbUsers.getActiveUsers();
        if (activeUsers.length === 0) return;

        for (const gem of gems) {
            const message = gem.summary;
            for (const userId of activeUsers) {
                try {
                    await bot.telegram.sendMessage(userId, message, { parse_mode: 'HTML' });
                } catch (sendErr) {
                    console.error(`Failed to send to ${userId}:`, sendErr.message);
                }
            }
        }
    } catch (err) {
        console.error("Broadcast Error:", err);
    }
};

module.exports = { bot, broadcastGems };
