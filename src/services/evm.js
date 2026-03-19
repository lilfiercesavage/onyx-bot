const axios = require('axios');

const FREE_RPC_ENDPOINTS = {
    'ethereum': 'https://eth.llamarpc.com',
    'base': 'https://base.llamarpc.com',
    'bsc': 'https://bsc-dataseed.binance.org',
    'arbitrum': 'https://arb1.arbitrum.io/rpc',
};

const MORALIS_CHAIN_MAP = {
    'ethereum': '0x1',
    'base': '0x2105',
    'bsc': '0x38',
    'arbitrum': '0xa4b1',
};

const checkDeployerBalance = async (chainId, tokenAddress, deployerAddress) => {
    if (chainId === 'solana') return { safe: true };
    
    const rpcUrl = FREE_RPC_ENDPOINTS[chainId];
    if (!rpcUrl) return { safe: true };
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    try {
        const response = await axios.post(rpcUrl, {
            jsonrpc: '2.0',
            method: 'eth_call',
            params: [{
                to: tokenAddress,
                data: `0x70a08231000000000000000000000000${deployerAddress.slice(2)}`
            }, 'latest'],
            id: 1
        }, { 
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal
        });
        
        clearTimeout(timeout);
        
        if (response.data?.result) {
            const balanceWei = BigInt(response.data.result);
            
            const supplyResponse = await axios.post(rpcUrl, {
                jsonrpc: '2.0',
                method: 'eth_call',
                params: [{
                    to: tokenAddress,
                    data: '0x18160ddd'
                }, 'latest'],
                id: 2
            }, { 
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal
            });
            
            let percentage = 0;
            if (supplyResponse.data?.result) {
                const supplyWei = BigInt(supplyResponse.data.result);
                if (supplyWei > 0n) {
                    percentage = (Number(balanceWei * 10000n / supplyWei) / 100);
                }
            }
            
            if (percentage > 15) {
                return { safe: false, reason: 'deployer_holds', percentage };
            }
            
            return { safe: true, percentage };
        }
        
        return { safe: true };
    } catch (error) {
        clearTimeout(timeout);
        console.log(`Deployer balance check failed: ${error.message}`);
        return { safe: true };
    }
};

const checkTopHolderConcentration = async (chainId, tokenAddress) => {
    if (chainId === 'solana') return { safe: true, holderAddresses: [] };
    
    const moralisKey = process.env.MORALIS_API_KEY;
    if (!moralisKey) {
        console.log('MORALIS_API_KEY not set, skipping holder concentration check');
        return { safe: true, holderAddresses: [] };
    }
    
    const moralisChain = MORALIS_CHAIN_MAP[chainId];
    if (!moralisChain) return { safe: true, holderAddresses: [] };
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    try {
        const response = await axios.get(
            `https://deep-index.moralis.io/api/v2.2/erc20/${tokenAddress}/top holders`,
            {
                params: { chain: moralisChain },
                headers: { 'X-API-Key': moralisKey },
                signal: controller.signal
            }
        );
        
        clearTimeout(timeout);
        
        if (response.data?.result && response.data.result.length > 0) {
            const holderAddresses = response.data.result.map(h => h.hash);
            
            for (const holder of response.data.result.slice(0, 10)) {
                const percentage = parseFloat(holder.percentage);
                if (percentage > 15) {
                    return { 
                        safe: false, 
                        reason: 'high_holder_concentration', 
                        maxPercentage: percentage,
                        holderAddress: holder.hash,
                        holderAddresses
                    };
                }
            }
            return { safe: true, holderAddresses };
        }
        
        return { safe: true, holderAddresses: [] };
    } catch (error) {
        clearTimeout(timeout);
        console.log(`Moralis holder check failed: ${error.message}`);
        return { safe: true, holderAddresses: [] };
    }
};

const checkSybilResistance = async (chainId, tokenAddress, topHolderAddresses) => {
    if (chainId === 'solana') return { safe: true };
    
    const moralisKey = process.env.MORALIS_API_KEY;
    if (!moralisKey) return { safe: true };
    
    const moralisChain = MORALIS_CHAIN_MAP[chainId];
    if (!moralisChain) return { safe: true };
    
    const suspiciousWallets = new Set();
    const firstFunders = new Map();
    
    for (const holderAddress of topHolderAddresses.slice(0, 5)) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        
        try {
            const response = await axios.get(
                `https://deep-index.moralis.io/api/v2.2/${holderAddress}`,
                {
                    params: { chain: moralisChain },
                    headers: { 'X-API-Key': moralisKey },
                    signal: controller.signal
                }
            );
            
            clearTimeout(timeout);
            
            if (response.data?.result && response.data.length > 0) {
                for (const tx of response.data.slice(0, 10)) {
                    if (tx.from_address && tx.from_address !== holderAddress) {
                        const count = firstFunders.get(tx.from_address) || 0;
                        firstFunders.set(tx.from_address, count + 1);
                    }
                }
            }
        } catch (error) {
            clearTimeout(timeout);
        }
    }
    
    for (const [funder, count] of firstFunders) {
        if (count >= 2) {
            suspiciousWallets.add(funder);
        }
    }
    
    if (suspiciousWallets.size > 0) {
        return { 
            safe: false, 
            reason: 'sybil_detected',
            linkedWallets: suspiciousWallets.size
        };
    }
    
    return { safe: true };
};

const checkCoordinatedTrading = async (chainId, tokenAddress, topHolderAddresses) => {
    if (chainId === 'solana') return { safe: true };
    
    const moralisKey = process.env.MORALIS_API_KEY;
    if (!moralisKey) return { safe: true };
    
    const moralisChain = MORALIS_CHAIN_MAP[chainId];
    if (!moralisChain) return { safe: true };
    
    const buyTimestamps = new Map();
    const maxConcurrent = 3;
    
    for (const holderAddress of topHolderAddresses.slice(0, 5)) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        
        try {
            const response = await axios.get(
                `https://deep-index.moralis.io/api/v2.2/${holderAddress}/erc20/transfers`,
                {
                    params: { 
                        chain: moralisChain,
                        contract_address: tokenAddress,
                        limit: 5
                    },
                    headers: { 'X-API-Key': moralisKey },
                    signal: controller.signal
                }
            );
            
            clearTimeout(timeout);
            
            if (response.data?.result) {
                for (const tx of response.data.result) {
                    if (tx.to_address?.toLowerCase() === holderAddress.toLowerCase()) {
                        const ts = parseInt(tx.transaction_hash?.timestamp || '0');
                        const count = buyTimestamps.get(ts) || 0;
                        buyTimestamps.set(ts, count + 1);
                    }
                }
            }
        } catch (error) {
            clearTimeout(timeout);
        }
    }
    
    for (const [timestamp, count] of buyTimestamps) {
        if (count >= maxConcurrent) {
            return { 
                safe: false, 
                reason: 'coordinated_buying',
                simultaneous: count
            };
        }
    }
    
    return { safe: true };
};

module.exports = { 
    checkDeployerBalance, 
    checkTopHolderConcentration,
    checkSybilResistance,
    checkCoordinatedTrading
};
