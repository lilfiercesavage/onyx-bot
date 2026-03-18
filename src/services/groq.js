const Groq = require('groq-sdk');
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const generateSummary = async (tokenData) => {
    try {
        const prompt = `You are a DeFi crypto analyst finding "Gems" for KOLs. 
Write a short, hype, compelling summary for the following token, highlighting why it's a good play.
Data:
Token: $${tokenData.baseToken.symbol} (${tokenData.baseToken.name})
Network: ${tokenData.chainId}
Price: $${tokenData.priceUsd}
Market Cap: $${tokenData.fdv}
Liquidity: $${tokenData.liquidity.usd}
Volume (1h): $${tokenData.volume.h1}
Signal Score: ${tokenData.signalScore.toFixed(2)}
Contract Address (CA): \`${tokenData.baseToken.address}\`

Format as a Telegram message. Emphasize that the contract is safe (GoPlus verified). Include the Contract Address prominently at the bottom for easy copying. Keep it short, actionable, and hype.`;

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: 'user', content: prompt }
            ],
            model: 'llama-3.1-8b-instant',
            temperature: 0.7,
            max_tokens: 300
        });

        return chatCompletion.choices[0]?.message?.content || "No summary generated.";
    } catch (error) {
        console.error("Groq Analysis Error:", error.message);
        return `🚨 GEM FOUND 🚨
$${tokenData.baseToken.symbol} on ${tokenData.chainId}
MC: $${tokenData.fdv}
Liq: $${tokenData.liquidity.usd}
Vol(1h): $${tokenData.volume.h1}
Score: ${tokenData.signalScore.toFixed(2)}
CA: ${tokenData.baseToken.address}`;
    }
};

module.exports = { generateSummary };
