const axios = require('axios');

const GOPLUS_CHAIN_MAP = {
    'ethereum': '1',
    'bsc': '56',
    'base': '8453',
    'arbitrum': '42161',
    // Solana has a different endpoint on GoPlus
};

const checkSecurity = async (chainId, contractAddress) => {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        
        try {
            if (chainId === 'solana') {
                const url = `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${contractAddress}`;
                const response = await axios.get(url, { signal: controller.signal });
                clearTimeout(timeout);
                if (response.data && response.data.result && response.data.result[contractAddress.toLowerCase()]) {
                    const data = response.data.result[contractAddress.toLowerCase()];
                    const isMalicious = (data.is_blacklisted === "1" || data.is_honeypot === "1");
                    return isMalicious ? 0 : 1; 
                }
                return 1;
            } else {
                const goPlusChainId = GOPLUS_CHAIN_MAP[chainId];
                if (!goPlusChainId) return 1;

                const url = `https://api.gopluslabs.io/api/v1/token_security/${goPlusChainId}?contract_addresses=${contractAddress}`;
                const response = await axios.get(url, { signal: controller.signal });
                clearTimeout(timeout);
                
                const lowerAddress = contractAddress.toLowerCase();
                if (response.data && response.data.result && response.data.result[lowerAddress]) {
                    const data = response.data.result[lowerAddress];
                    if (data.is_honeypot === "1" || data.is_blacklisted === "1" || data.cannot_sell_all === "1") {
                        return 0;
                    }
                    return 1;
                }
                return 1;
            }
        } catch (innerErr) {
            clearTimeout(timeout);
            throw innerErr;
        }
    } catch (error) {
        console.error("GoPlus Check Error:", error.message);
        return 0; // Default to unsafe on error for safety
    }
};

module.exports = { checkSecurity };
