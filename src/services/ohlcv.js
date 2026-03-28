const axios = require('axios');

const BIRDEYE_API = 'https://api.birdeye.so';
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

const fetchBirdeyeOHLCV = async (tokenAddress, chain = 'solana', timeframe = '1H') => {
    try {
        const timeframeMap = {
            '1H': '1h',
            '4H': '4h', 
            '1D': '1d',
            '1W': '1w'
        };
        
        const response = await axios.get(`${BIRDEYE_API}/defi/ohlcv`, {
            params: {
                address: tokenAddress,
                chain: chain,
                type: timeframeMap[timeframe] || '1h',
                limit: 60
            },
            timeout: 10000
        });
        
        if (response.data?.data?.items) {
            return response.data.data.items.map(candle => ({
                timestamp: candle.time,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
                volume: candle.volume
            }));
        }
        return null;
    } catch (e) {
        console.log(`Birdeye OHLCV unavailable: ${e.message}`);
        return null;
    }
};

const fetchDexScreenerCandles = async (pairAddress) => {
    try {
        const response = await axios.get(`https://api.dexscreener.com/latest/dex/pairs/${pairAddress}/candles`, {
            params: {
                from: Math.floor(Date.now() / 1000) - 3600,
                to: Math.floor(Date.now() / 1000),
                resolution: '1m'
            },
            timeout: 10000
        });
        
        if (response.data?.candles) {
            return response.data.candles.map(candle => ({
                timestamp: candle.time,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
                volume: candle.volume
            }));
        }
        return null;
    } catch (e) {
        console.log(`DexScreener candles unavailable: ${e.message}`);
        return null;
    }
};

const simulateOHLCVFromTrades = async (tokenAddress, pairAddress) => {
    const prices = [];
    const volumes = [];
    
    try {
        const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
        
        if (response.data?.pairs?.[0]) {
            const pair = response.data.pairs[0];
            const price = pair.priceUsd || 0;
            const volume = pair.volume?.h1 || 0;
            
            prices.push(price);
            volumes.push(volume);
            
            return {
                high: price * 1.5,
                low: price * 0.5,
                open: price,
                close: price,
                volume: volume,
                simulated: true,
                note: 'Estimated from current price ±50%'
            };
        }
    } catch (e) {
        console.log(`Simulate OHLCV failed: ${e.message}`);
    }
    
    return null;
};

const fetchTrueMarketCap = async (tokenAddress, price, chain = 'solana') => {
    try {
        if (chain === 'solana') {
            const response = await axios.get(`${BIRDEYE_API}/defi/token_meta`, {
                params: { address: tokenAddress },
                timeout: 10000
            });
            
            if (response.data?.data) {
                const supply = response.data.data.supply || response.data.data.decimals || 0;
                const decimals = response.data.data.decimals || 9;
                const formattedSupply = supply / Math.pow(10, decimals);
                const trueMcap = price * formattedSupply;
                
                return {
                    supply: formattedSupply,
                    decimals: decimals,
                    trueMcap: trueMcap,
                    method: 'Birdeye supply'
                };
            }
        }
        
        return {
            supply: 0,
            decimals: 9,
            trueMcap: 0,
            method: 'FDV fallback'
        };
    } catch (e) {
        console.log(`True MCAP fetch failed: ${e.message}`);
        return {
            supply: 0,
            decimals: 9,
            trueMcap: 0,
            method: 'Error - using FDV'
        };
    }
};

const getSpikeMetrics = (candles) => {
    if (!candles || candles.length === 0) return null;
    
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const closes = candles.map(c => c.close);
    
    const periodHigh = Math.max(...highs);
    const periodLow = Math.min(...lows);
    const open = candles[0].open;
    const close = closes[closes.length - 1];
    
    const spikePercent = periodHigh > open ? ((periodHigh - open) / open) * 100 : 0;
    const drawdownPercent = periodLow < open ? ((open - periodLow) / open) * 100 : 0;
    
    return {
        periodHigh,
        periodLow,
        open,
        close,
        spikePercent: spikePercent.toFixed(2),
        drawdownPercent: drawdownPercent.toFixed(2),
        volatility: ((periodHigh - periodLow) / open * 100).toFixed(2)
    };
};

module.exports = {
    fetchBirdeyeOHLCV,
    fetchDexScreenerCandles,
    simulateOHLCVFromTrades,
    fetchTrueMarketCap,
    getSpikeMetrics
};