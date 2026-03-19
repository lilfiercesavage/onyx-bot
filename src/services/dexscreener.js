const axios = require('axios');

const fetchLatestTokens = async () => {
    try {
        const response = await axios.get('https://api.dexscreener.com/token-boosts/latest/v1');
        const tokens = response.data;
        
        if (!tokens || tokens.length === 0) {
            console.log('No boosted tokens found, trying recent pairs...');
            return await fetchRecentPairs();
        }
        
        const validTokens = tokens.filter(t => t.chainId === 'solana' || t.chainId === 'ethereum');
        
        if (validTokens.length === 0) {
            console.log('No valid tokens from boost API');
            return await fetchRecentPairs();
        }
        
        console.log(`Found ${validTokens.length} boosted tokens`);
        
        const maxTokens = validTokens.slice(0, 150);
        const chunks = [];
        for (let i = 0; i < maxTokens.length; i += 30) {
            chunks.push(maxTokens.slice(i, i + 30).map(t => t.tokenAddress).join(','));
        }
        
        if (chunks.length === 0) return [];

        let allPairs = [];
        for (const chunk of chunks) {
            try {
                const pairsResponse = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${chunk}`);
                if (pairsResponse.data && pairsResponse.data.pairs) {
                    allPairs = allPairs.concat(pairsResponse.data.pairs);
                }
            } catch (chunkErr) {
                console.error("DexScreener chunk fetch error:", chunkErr.message);
            }
        }

        return allPairs;
    } catch (error) {
        console.error("DexScreener fetch error:", error.message);
        return await fetchRecentPairs();
    }
};

const fetchRecentPairs = async () => {
    try {
        const response = await axios.get('https://api.dexscreener.com/latest/dex/pairs/solana?limit=50');
        if (response.data?.pairs) {
            console.log(`Fallback: found ${response.data.pairs.length} Solana pairs`);
            return response.data.pairs;
        }
    } catch (err) {
        console.error("Fallback fetch error:", err.message);
    }
    return [];
};

const KNOWN_CEX_WALLETS = new Set([
    '0x28c6c06298d514db089934071355e5743bf21d60', // Binance hot wallet
    '0x21a31ee1afc51d94c2efccaa2092ad1028285549', // Binance cold
    '0x56eddb7aa87536c09ccc2793473599fd21a8b17f', // Binance deposit
    '0x9696f00e882d77a38a4a1d70d7a0c7e9f94ac5c5', // Coinbase
    '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be', // Kraken
    '0x0a869d79a7052c7f1b55a8ebabbea3420f0d1e13', // Bitfinex
]);

const filterGems = (pairs) => {
    const gems = [];
    const now = Date.now();

    for (const pair of pairs) {
        if (pair.chainId !== 'solana' && pair.chainId !== 'ethereum') continue;

        const mc = pair.fdv || 0;
        const liquidity = pair.liquidity?.usd || 0;
        const volume1h = pair.volume?.h1 || 0;
        const txs1h = (pair.txns?.h1?.buys || 0) + (pair.txns?.h1?.sells || 0);
        
        const pairCreatedAt = pair.pairCreatedAt || 0;
        const ageInMinutes = (now - pairCreatedAt) / (1000 * 60);

        const buys1h = pair.txns?.h1?.buys || 0;
        const sells1h = pair.txns?.h1?.sells || 0;
        const buySellRatio = sells1h > 0 ? buys1h / sells1h : buys1h;
        
        // 🚩 RED FLAG: Extremely fresh tokens (<3 min) - likely sniper bots or dev dump setup
        if (ageInMinutes < 3) continue;

        // 🚩 RED FLAG: Sell pressure is too high
        if (buySellRatio > 5) continue;

        // 🚩 RED FLAG: Way too little liquidity - easy to rug
        if (liquidity < 5000) continue;

        // 🚩 RED FLAG: MC/Liq ratio suspicious
        const liqRatio = liquidity / mc;
        if (liqRatio < 0.15) continue;
        if (liqRatio > 0.85) continue; // Unrealistic high liq
        
        // 🚩 RED FLAG: Very fresh + low liquidity = pump and dump setup
        if (ageInMinutes < 10 && liquidity < 10000) continue;

        // 🚩 RED FLAG: Check deployer/creator wallet activity
        const creatorAddress = pair.creatorAddress?.toLowerCase();
        if (creatorAddress) {
            // Check if deployer wallet is in the known CEX list (unlikely for fresh tokens)
            if (KNOWN_CEX_WALLETS.has(creatorAddress)) continue;
            
            // For EVM chains, note deployer address for balance check later
            // Store in pair data for scanner to handle
        }

        // 🚩 RED FLAG: Very low transaction count suggests wash trading or dead token
        if (txs1h < 5 && ageInMinutes > 15) continue;

        // Filters: MC < $500k, Age < 60 mins (fresh tokens)
        if (mc > 500 && mc < 500000 && ageInMinutes < 60) {
            
            // Calculate sell penalty based on buy/sell ratio
            // Ideal ratio is 1:1, penalize heavily if ratio is bad
            let sellPenalty = 1;
            if (buySellRatio < 0.5) {
                sellPenalty = 0.3; // Heavy sell pressure
            } else if (buySellRatio < 1) {
                sellPenalty = 0.6; // Moderate sell pressure
            } else if (buySellRatio > 3) {
                sellPenalty = 0.7; // Suspicious high buys (possible wash trading)
            }
            
            const normalizedLiq = liquidity / 1000;
            const normalizedVol = volume1h / 1000;
            const normalizedSoc = txs1h;

            const signalScore = ((normalizedLiq * 0.5) + (normalizedVol * 0.3) + (normalizedSoc * 0.2)) * sellPenalty;

            gems.push({
                ...pair,
                signalScore,
                sellPenalty
            });
        }
    }

    return gems.sort((a, b) => b.signalScore - a.signalScore);
};

module.exports = { fetchLatestTokens, filterGems };
