const { Telegraf } = require('telegraf');
const dbUsers = require('../db/users');
const { checkAccess } = require('../db/users');
require('dotenv').config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.start(async (ctx) => {
    try {
        const userId = ctx.from.id;
        await dbUsers.activateUser(userId);
        
        ctx.reply("Welcome to DeFi Intelligence Layer! 🚀\nYour account is now active. You will receive High-Potential Gems as they are discovered.");
    } catch (err) {
        console.error("Bot Start Error:", err);
        ctx.reply("Welcome to DeFi Intelligence Layer! 🚀");
    }
});

bot.command('status', async (ctx) => {
    ctx.reply("Status: Active ✅\nYou have full access to all gems.");
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
