require('dotenv').config();
const { Telegraf } = require('telegraf');
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

async function test() {
    try {
        console.log("Testing connection...");
        const me = await bot.telegram.getMe();
        console.log("Bot info:", me.username);
        process.exit(0);
    } catch (err) {
        console.error("Test failed:", err.message);
        process.exit(1);
    }
}

test();
