import crypto from 'crypto';

const BYBIT_TESTNET_URL = 'https://api-testnet.bybit.com';

function generateBybitHeaders(apiKey: string | undefined, apiSecret: string | undefined, payload: string = ''): Record<string, string> {
    if (!apiKey || !apiSecret) return {};
    const timestamp = Date.now().toString();
    const recvWindow = '5000';
    const signPayload = timestamp + apiKey + recvWindow + payload;
    const signature = crypto.createHmac('sha256', apiSecret).update(signPayload).digest('hex');
    
    return {
        'X-BAPI-API-KEY': apiKey,
        'X-BAPI-SIGN': signature,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': recvWindow,
        'Content-Type': 'application/json'
    } satisfies Record<string, string>;
}

export async function fetchBybitOrderBook(symbol: string) {
    try {
        const apiKey = process.env.BYBIT_API_KEY;
        const apiSecret = process.env.BYBIT_API_SECRET;
        
        // GET /v5/market/orderbook?category=spot&symbol=SYMBOL
        const qs = `category=spot&symbol=${symbol}`;
        const headers = generateBybitHeaders(apiKey, apiSecret, qs);
        
        const response = await fetch(`${BYBIT_TESTNET_URL}/v5/market/orderbook?${qs}`, {
            headers
        });
        
        if (!response.ok) {
            throw new Error(`Bybit API responded with status ${response.status}`);
        }
        
        const data = await response.json();
        return data?.result || { b: [], a: [] };
    } catch (error) {
        console.error(`[Ingestion Error] fetchBybitOrderBook failed for ${symbol}:`, error);
        // Graceful degradation
        return { b: [], a: [], fallback: true };
    }
}

export async function fetchBybitPerpetuals(symbol: string) {
    try {
        const apiKey = process.env.BYBIT_API_KEY;
        const apiSecret = process.env.BYBIT_API_SECRET;
        
        // GET /v5/market/tickers?category=linear&symbol=SYMBOL
        const qs = `category=linear&symbol=${symbol}`;
        const headers = generateBybitHeaders(apiKey, apiSecret, qs);
        
        const response = await fetch(`${BYBIT_TESTNET_URL}/v5/market/tickers?${qs}`, {
            headers
        });
        
        if (!response.ok) {
            throw new Error(`Bybit API responded with status ${response.status}`);
        }
        
        const data = await response.json();
        const item = data?.result?.list?.[0] || {};
        return {
            openInterest: item.openInterest || "0",
            fundingRate: item.fundingRate || "0",
            fallback: false
        };
    } catch (error) {
        console.error(`[Ingestion Error] fetchBybitPerpetuals failed for ${symbol}:`, error);
        // Graceful degradation
        return { openInterest: "0", fundingRate: "0", fallback: true };
    }
}

export async function fetchDexScreenerData(contractAddress: string) {
    try {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`);
        
        if (!response.ok) {
            throw new Error(`DexScreener API responded with status ${response.status}`);
        }
        
        const data = await response.json();
        const pair = data?.pairs?.[0] || {};
        
        return {
            liquidityUsd: pair.liquidity?.usd || 0,
            volume24h: pair.volume?.h24 || 0,
            fdv: pair.fdv || 0,
            priceUsd: pair.priceUsd || "0",
            fallback: false
        };
    } catch (error) {
        console.error(`[Ingestion Error] fetchDexScreenerData failed for ${contractAddress}:`, error);
        return { liquidityUsd: 0, volume24h: 0, fdv: 0, priceUsd: "0", fallback: true };
    }
}

export async function fetchCoinGeckoMacro(coinId: string) {
    try {
        const apiKey = process.env.COINGECKO_API_KEY;
        const headers: Record<string, string> = {
            'Accept': 'application/json'
        };
        
        if (apiKey) {
            headers['x-cg-demo-api-key'] = apiKey;
        }
        
        const response = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`, {
            headers
        });
        
        if (!response.ok) {
            throw new Error(`CoinGecko API responded with status ${response.status}`);
        }
        
        const data = await response.json();
        return {
            marketCap: data?.market_data?.market_cap?.usd || 0,
            fdv: data?.market_data?.fully_diluted_valuation?.usd || 0,
            volume24h: data?.market_data?.total_volume?.usd || 0,
            fallback: false
        };
    } catch (error) {
        console.error(`[Ingestion Error] fetchCoinGeckoMacro failed for ${coinId}:`, error);
        return { marketCap: 0, fdv: 0, volume24h: 0, fallback: true };
    }
}
