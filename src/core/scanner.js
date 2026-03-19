const dexscreener = require('../services/dexscreener');
const goplus = require('../services/goplus');
const evm = require('../services/evm');
const groq = require('../services/groq');
const tokenDb = require('../db/tokens');

const scanForGems = async () => {
    console.log(`[${new Date().toISOString()}] Scanning for new Gems...`);
    const pairs = await dexscreener.fetchLatestTokens();
    
    if (pairs.length === 0) {
        console.log('No new pairs found.');
        return [];
    }

    const potentialGems = dexscreener.filterGems(pairs).slice(0, 100);
    console.log(`Found ${potentialGems.length} potential gems before security check.`);

    const validGems = [];

    for (const gem of potentialGems) {
        // Check if already called (24hr cooldown)
        const isCalled = await tokenDb.isTokenCalled(gem.baseToken.address);
        if (isCalled) {
            continue;
        }

        // 🚩 Check deployer token balance (EVM chains only)
        if (gem.creatorAddress && gem.chainId !== 'solana') {
            const deployerCheck = await evm.checkDeployerBalance(
                gem.chainId,
                gem.baseToken.address,
                gem.creatorAddress
            );
            if (!deployerCheck.safe) {
                console.log(`Filtered ${gem.baseToken.symbol}: Deployer holds ${deployerCheck.percentage.toFixed(1)}%`);
                continue;
            }
            
            // 🚩 Check any holder >15% (requires MORALIS_API_KEY in .env)
            const holderCheck = await evm.checkTopHolderConcentration(
                gem.chainId,
                gem.baseToken.address
            );
            if (!holderCheck.safe) {
                console.log(`Filtered ${gem.baseToken.symbol}: Top holder has ${holderCheck.maxPercentage.toFixed(1)}%`);
                continue;
            }
        }

        // Check GoPlus + Token Sniffer Security
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
