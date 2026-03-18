const dexscreener = require('../services/dexscreener');
const goplus = require('../services/goplus');
const groq = require('../services/groq');
const tokenDb = require('../db/tokens');

const scanForGems = async () => {
    console.log(`[${new Date().toISOString()}] Scanning for new Gems...`);
    const pairs = await dexscreener.fetchLatestTokens();
    
    if (pairs.length === 0) {
        console.log('No new pairs found.');
        return [];
    }

    const potentialGems = dexscreener.filterGems(pairs);
    console.log(`Found ${potentialGems.length} potential gems before security check.`);

    const validGems = [];

    for (const gem of potentialGems) {
        // Check if already called
        const isCalled = await tokenDb.isTokenCalled(gem.baseToken.address);
        if (isCalled) {
            continue;
        }

        // Check GoPlus Security (Safety Multiplier M_safe)
        const mSafe = await goplus.checkSecurity(gem.chainId, gem.baseToken.address);
        
        // Final Score 
        gem.signalScore = gem.signalScore * mSafe;

        if (mSafe === 1 && gem.signalScore > 0) {
            // Generate Summary
            const summary = await groq.generateSummary(gem);
            
            validGems.push({
                ...gem,
                summary
            });

            // Mark as called
            await tokenDb.markTokenCalled(gem.baseToken.address, gem.pairAddress, gem.signalScore, gem.fdv);
        }
    }

    return validGems;
};

module.exports = { scanForGems };
