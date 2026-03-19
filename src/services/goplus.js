const axios = require('axios');

const GOPLUS_CHAIN_MAP = {
    'ethereum': '1',
    'bsc': '56',
    'base': '8453',
    'arbitrum': '42161',
};

const TOKEN_SNIFFER_CHAIN_MAP = {
    'ethereum': 'ethereum',
    'bsc': 'binance_smart_chain',
    'base': 'base',
    'arbitrum': 'arbitrum',
};

const checkGoPlus = async (chainId, contractAddress) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    try {
        if (chainId === 'solana') {
            const url = `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${contractAddress}`;
            const response = await axios.get(url, { signal: controller.signal });
            clearTimeout(timeout);
            if (response.data?.result?.[contractAddress.toLowerCase()]) {
                const data = response.data.result[contractAddress.toLowerCase()];
                return !(data.is_blacklisted === "1" || data.is_honeypot === "1");
            }
            return true;
        } else {
            const goPlusChainId = GOPLUS_CHAIN_MAP[chainId];
            if (!goPlusChainId) return true;

            const url = `https://api.gopluslabs.io/api/v1/token_security/${goPlusChainId}?contract_addresses=${contractAddress}`;
            const response = await axios.get(url, { signal: controller.signal });
            clearTimeout(timeout);
            
            const lowerAddress = contractAddress.toLowerCase();
            if (response.data?.result?.[lowerAddress]) {
                const data = response.data.result[lowerAddress];
                return !(data.is_honeypot === "1" || data.is_blacklisted === "1" || data.cannot_sell_all === "1");
            }
            return true;
        }
    } catch (innerErr) {
        clearTimeout(timeout);
        return true;
    }
};

const checkTokenSniffer = async (chainId, contractAddress) => {
    const snifferChain = TOKEN_SNIFFER_CHAIN_MAP[chainId];
    if (!snifferChain) return true;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    try {
        const url = `https://tokensniffer.com/api/v2/token/full/${snifferChain}/${contractAddress}`;
        const response = await axios.get(url, { signal: controller.signal });
        clearTimeout(timeout);
        
        if (response.data) {
            const score = response.data.overallScore || 50;
            const isScam = response.data.scam === true || score < 20;
            return !isScam;
        }
        return true;
    } catch (err) {
        clearTimeout(timeout);
        return true;
    }
};

const checkSecurity = async (chainId, contractAddress) => {
    const [goPlusSafe, snifferSafe] = await Promise.all([
        checkGoPlus(chainId, contractAddress),
        checkTokenSniffer(chainId, contractAddress)
    ]);
    
    if (!goPlusSafe || !snifferSafe) {
        console.log(`Security failed: GoPlus=${goPlusSafe}, Sniffer=${snifferSafe}`);
        return 0;
    }
    
    return 1;
};

module.exports = { checkSecurity };
