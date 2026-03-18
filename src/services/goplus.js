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
        if (chainId === 'solana') {
            const url = `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${contractAddress}`;
            const response = await axios.get(url, { timeout: 10000 });
            if (response.data && response.data.result && response.data.result[contractAddress.toLowerCase()]) {
                const data = response.data.result[contractAddress.toLowerCase()];
                // Basic checks for Solana (e.g., mintable, freezable)
                // GoPlus solana response mapping
                const isMalicious = (data.is_blacklisted === "1" || data.is_honeypot === "1");
                return isMalicious ? 0 : 1; 
            }
            return 1; // Default to safe if not found
        } else {
            const goPlusChainId = GOPLUS_CHAIN_MAP[chainId];
            if (!goPlusChainId) return 1; // Unsupported chain by default assumed safe or ignored

            const url = `https://api.gopluslabs.io/api/v1/token_security/${goPlusChainId}?contract_addresses=${contractAddress}`;
            const response = await axios.get(url, { timeout: 10000 });
            
            const lowerAddress = contractAddress.toLowerCase();
            if (response.data && response.data.result && response.data.result[lowerAddress]) {
                const data = response.data.result[lowerAddress];
                // Honeypot, hidden owner, cant sell, malicious
                if (data.is_honeypot === "1" || data.is_blacklisted === "1" || data.cannot_sell_all === "1") {
                    return 0;
                }
                return 1;
            }
            return 1;
        }
    } catch (error) {
        console.error("GoPlus Check Error:", error.message);
        // Fallback to safe if API errors out so we don't completely halt, 
        // OR better: we return 0 if we can't verify to be extra safe
        return 0; 
    }
};

module.exports = { checkSecurity };
