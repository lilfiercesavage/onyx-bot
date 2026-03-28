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
        const isCalled = await tokenDb.isTokenCalled(gem.baseToken.address);
        if (isCalled) {
            continue;
        }

        // 🚩 EVM Security Checks
        if (gem.chainId !== 'solana') {
            // Deployer balance check
            if (gem.creatorAddress) {
                const deployerCheck = await evm.checkDeployerBalance(
                    gem.chainId,
                    gem.baseToken.address,
                    gem.creatorAddress
                );
                if (!deployerCheck.safe) {
                    console.log(`Filtered ${gem.baseToken.symbol}: Deployer holds ${deployerCheck.percentage.toFixed(1)}%`);
                    continue;
                }
            }
            
            // Top holder >15% + get addresses for sybil check
            const holderCheck = await evm.checkTopHolderConcentration(
                gem.chainId,
                gem.baseToken.address
            );
            if (!holderCheck.safe) {
                console.log(`Filtered ${gem.baseToken.symbol}: Top holder has ${holderCheck.maxPercentage.toFixed(1)}%`);
                continue;
            }
            
            // 🚩 Sybil Detection - wallets funded by same source
            if (holderCheck.holderAddresses.length > 0) {
                const sybilCheck = await evm.checkSybilResistance(
                    gem.chainId,
                    gem.baseToken.address,
                    holderCheck.holderAddresses
                );
                if (!sybilCheck.safe) {
                    console.log(`Filtered ${gem.baseToken.symbol}: Sybil wallets detected (${sybilCheck.linkedWallets})`);
                    continue;
                }
                
                // 🚩 Coordinated Trading - wallets buying at exact same timestamp
                const coordCheck = await evm.checkCoordinatedTrading(
                    gem.chainId,
                    gem.baseToken.address,
                    holderCheck.holderAddresses
                );
                if (!coordCheck.safe) {
                    console.log(`Filtered ${gem.baseToken.symbol}: Coordinated buying detected`);
                    continue;
                }
            }
        }

        // Check GoPlus + Token Sniffer Security
        const mSafe = await goplus.checkSecurity(gem.chainId, gem.baseToken.address);
        
        gem.signalScore = gem.signalScore * mSafe;

        if (mSafe === 1 && gem.signalScore > 0) {
            const summary = await groq.generateSummary(gem);
            
            validGems.push({
                ...gem,
                summary
            });

            await tokenDb.markTokenCalled(gem.baseToken.address, gem.pairAddress, gem.signalScore, gem.fdv, gem.supply || 0);
            await tokenDb.addToActiveTracking(gem.baseToken.address, gem.pairAddress, gem.signalScore, gem.fdv, gem.supply || 0);
            
            console.log(`[GEM FOUND] ${gem.baseToken.symbol} - Added to active tracking for spike monitoring`);
        }
    }

    return validGems;
};

module.exports = { scanForGems };
