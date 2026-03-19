const axios = require('axios');

const FREE_RPC_ENDPOINTS = {
    'ethereum': 'https://eth.llamarpc.com',
    'base': 'https://base.llamarpc.com',
    'bsc': 'https://bsc-dataseed.binance.org',
    'arbitrum': 'https://arb1.arbitrum.io/rpc',
};

const checkDeployerBalance = async (chainId, tokenAddress, deployerAddress) => {
    if (chainId === 'solana') return { safe: true }; // Skip for Solana
    
    const rpcUrl = FREE_RPC_ENDPOINTS[chainId];
    if (!rpcUrl) return { safe: true }; // Unknown chain, assume safe
    
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
            const balanceHex = response.data.result;
            const balanceWei = BigInt(balanceHex);
            
            // Get total supply to calculate percentage
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
            
            // 🚩 RED FLAG: Deployer holds >15% of supply
            if (percentage > 15) {
                return { safe: false, reason: 'deployer_holds', percentage };
            }
            
            return { safe: true, percentage };
        }
        
        return { safe: true };
    } catch (error) {
        clearTimeout(timeout);
        console.log(`Deployer balance check failed for ${chainId}: ${error.message}`);
        return { safe: true }; // Fail open on error
    }
};

module.exports = { checkDeployerBalance };
