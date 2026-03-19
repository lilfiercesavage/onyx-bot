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
    if (chainId === 'solana') return { safe: true };
    
    const morlaisKey = process.env.MORALIS_API_KEY;
    if (!morlaisKey) {
        console.log('MORALIS_API_KEY not set, skipping holder concentration check');
        return { safe: true };
    }
    
    const moralisChain = MORALIS_CHAIN_MAP[chainId];
    if (!moralisChain) return { safe: true };
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    try {
        const response = await axios.get(
            `https://deep-index.moralis.io/api/v2.2/erc20/${tokenAddress}/top holders`,
            {
                params: { chain: moralisChain },
                headers: { 'X-API-Key': morlaisKey },
                signal: controller.signal
            }
        );
        
        clearTimeout(timeout);
        
        if (response.data?.result && response.data.result.length > 0) {
            for (const holder of response.data.result.slice(0, 10)) {
                const percentage = parseFloat(holder.percentage);
                if (percentage > 15) {
                    return { 
                        safe: false, 
                        reason: 'high_holder_concentration', 
                        maxPercentage: percentage,
                        holderAddress: holder.hash
                    };
                }
            }
            return { safe: true };
        }
        
        return { safe: true };
    } catch (error) {
        clearTimeout(timeout);
        console.log(`Moralis holder check failed: ${error.message}`);
        return { safe: true };
    }
};

module.exports = { checkDeployerBalance, checkTopHolderConcentration };
