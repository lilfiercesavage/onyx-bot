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

const filterGems = (pairs) => {
    const gems = [];
    const now = Date.now();

    for (const pair of pairs) {
        // Must be Solana or Ethereum
        if (pair.chainId !== 'solana' && pair.chainId !== 'ethereum') continue;

        const mc = pair.fdv || 0; // Fully diluted valuation as Market Cap approximation
        const liquidity = pair.liquidity?.usd || 0;
        const volume1h = pair.volume?.h1 || 0;
        // Approximation of social growth through tx count
        const txs1h = (pair.txns?.h1?.buys || 0) + (pair.txns?.h1?.sells || 0); 
        
        const pairCreatedAt = pair.pairCreatedAt || 0;
        const ageInMinutes = (now - pairCreatedAt) / (1000 * 60);

        // Valid social presence check
        const hasSocials = pair.info && pair.info.socials && pair.info.socials.length > 0;

        // Filters: MC < $500k, Liquidity/MC > 8%, Age < 60 mins (fresh tokens)
        if (mc > 500 && mc < 500000 && liquidity > 500 && (liquidity / mc) > 0.08 && ageInMinutes < 60) {
            
            // Core Logic: Signal Score Formula
            // Signal Score = (Liquidity * 0.5) + (Volume1h * 0.3) + (Social_Growth * 0.2)
            const normalizedLiq = liquidity / 1000;
            const normalizedVol = volume1h / 1000;
            const normalizedSoc = txs1h;

            const signalScore = (normalizedLiq * 0.5) + (normalizedVol * 0.3) + (normalizedSoc * 0.2);

            gems.push({
                ...pair,
                signalScore
            });
        }
    }

    return gems.sort((a, b) => b.signalScore - a.signalScore);
};

module.exports = { fetchLatestTokens, filterGems };
