import crypto from 'crypto';
import { DispatcherStrategy } from '../mcts/dispatcher';

const BYBIT_TESTNET_URL = process.env.BYBIT_BASE_URL || 'https://api-testnet.bytick.com';

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

export async function fetchBybitOrderBook(symbol: string, strategy?: DispatcherStrategy) {
    try {
        if (strategy && !strategy.bybit_v5?.endpoints?.["/v5/market/orderbook"]) {
            console.log("⏭️ [Ingestion] Skipping Bybit Order Book fetch (not requested by dispatcher)");
            return { b: [], a: [], fallback: false, skipped: true };
        }

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
        const orderbookData = data?.result || { b: [], a: [] };
        
        const requestedFields = strategy?.bybit_v5?.endpoints?.["/v5/market/orderbook"];
        const result: any = { fallback: false };
        
        if (!requestedFields || requestedFields.includes("a (asks)")) {
            result.a = orderbookData.a || [];
        }
        if (!requestedFields || requestedFields.includes("b (bids)")) {
            result.b = orderbookData.b || [];
        }
        
        return result;
    } catch (error) {
        console.error(`[Ingestion Error] fetchBybitOrderBook failed for ${symbol}:`, error);
        return { b: [], a: [], fallback: true };
    }
}

export async function fetchBybitPerpetuals(symbol: string, strategy?: DispatcherStrategy) {
    try {
        if (strategy && !strategy.bybit_v5?.endpoints?.["/v5/market/tickers"]) {
            console.log("⏭️ [Ingestion] Skipping Bybit Tickers fetch (not requested by dispatcher)");
            return { openInterest: "0", fundingRate: "0", fallback: false, skipped: true };
        }

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
        
        const requestedFields = strategy?.bybit_v5?.endpoints?.["/v5/market/tickers"];
        const result: any = { fallback: false };
        
        if (!requestedFields || requestedFields.includes("lastPrice")) result.lastPrice = item.lastPrice || "0";
        if (!requestedFields || requestedFields.includes("price24hPcnt")) result.price24hPcnt = item.price24hPcnt || "0";
        if (!requestedFields || requestedFields.includes("volume24h")) result.volume24h = item.volume24h || "0";
        if (!requestedFields || requestedFields.includes("bid1Price")) result.bid1Price = item.bid1Price || "0";
        if (!requestedFields || requestedFields.includes("ask1Price")) result.ask1Price = item.ask1Price || "0";
        
        // Always return these for ReAct compatibility
        result.openInterest = item.openInterest || "0";
        result.fundingRate = item.fundingRate || "0";
        
        return result;
    } catch (error) {
        console.error(`[Ingestion Error] fetchBybitPerpetuals failed for ${symbol}:`, error);
        return { openInterest: "0", fundingRate: "0", fallback: true };
    }
}

export async function fetchDexScreenerData(contractAddress: string, strategy?: DispatcherStrategy) {
    try {
        if (strategy && !strategy.dexscreener?.endpoints?.["/latest/dex/pairs/{chainId}/{pairId}"]) {
            console.log("⏭️ [Ingestion] Skipping DexScreener fetch (not requested by dispatcher)");
            return { liquidityUsd: 0, volume24h: 0, fdv: 0, priceUsd: "0", fallback: false, skipped: true };
        }

        const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`);
        
        if (!response.ok) {
            throw new Error(`DexScreener API responded with status ${response.status}`);
        }
        
        const data = await response.json();
        const pair = data?.pairs?.[0] || {};
        
        const requestedFields = strategy?.dexscreener?.endpoints?.["/latest/dex/pairs/{chainId}/{pairId}"];
        const result: any = { fallback: false };
        
        if (!requestedFields || requestedFields.includes("priceUsd")) {
            result.priceUsd = pair.priceUsd || "0";
        }
        if (!requestedFields || requestedFields.includes("txns.h24")) {
            result.txns24h = pair.txns?.h24 || {};
        }
        if (!requestedFields || requestedFields.includes("volume.h24")) {
            result.volume24h = pair.volume?.h24 || 0;
        }
        if (!requestedFields || requestedFields.includes("priceChange.h24")) {
            result.priceChange24h = pair.priceChange?.h24 || 0;
        }
        if (!requestedFields || requestedFields.includes("liquidity.usd")) {
            result.liquidityUsd = pair.liquidity?.usd || 0;
        }
        if (!requestedFields || requestedFields.includes("fdv")) {
            result.fdv = pair.fdv || 0;
        }
        if (!requestedFields || requestedFields.includes("marketCap")) {
            result.marketCap = pair.marketCap || 0;
        }
        
        return result;
    } catch (error) {
        console.error(`[Ingestion Error] fetchDexScreenerData failed for ${contractAddress}:`, error);
        return { liquidityUsd: 0, volume24h: 0, fdv: 0, priceUsd: "0", fallback: true };
    }
}

export async function fetchDefiLlamaProtocols(coinSymbol: string, strategy?: DispatcherStrategy) {
    try {
        if (strategy && !strategy.defillama?.endpoints?.["/protocols"]) {
            console.log("⏭️ [Ingestion] Skipping DefiLlama fetch (not requested by dispatcher)");
            return { fallback: false, skipped: true };
        }
        
        const response = await fetch("https://api.llama.fi/protocols");
        if (!response.ok) {
            throw new Error(`DefiLlama API responded with status ${response.status}`);
        }
        const protocols = await response.json();
        const symbolUpper = coinSymbol.toUpperCase();
        const protocol = protocols.find((p: any) => p.symbol?.toUpperCase() === symbolUpper || p.name?.toUpperCase() === symbolUpper) || {};
        
        const requestedFields = strategy?.defillama?.endpoints?.["/protocols"];
        const result: any = { fallback: false };
        
        if (!requestedFields || requestedFields.includes("tvl")) {
            result.tvl = protocol.tvl || 0;
        }
        if (!requestedFields || requestedFields.includes("change_1d")) {
            result.change_1d = protocol.change_1d || 0;
        }
        if (!requestedFields || requestedFields.includes("change_7d")) {
            result.change_7d = protocol.change_7d || 0;
        }
        
        return result;
    } catch (error) {
        console.error(`[Ingestion Error] fetchDefiLlamaProtocols failed for ${coinSymbol}:`, error);
        return { fallback: true };
    }
}

export async function fetchCoinGeckoMarkets(coinId: string, strategy?: DispatcherStrategy) {
    try {
        if (strategy && !strategy.coingecko?.endpoints?.["/coins/markets"]) {
            console.log("⏭️ [Ingestion] Skipping CoinGecko markets fetch (not requested by dispatcher)");
            return { fallback: false, skipped: true };
        }
        
        const apiKey = process.env.COINGECKO_API_KEY;
        const headers: Record<string, string> = { 'Accept': 'application/json' };
        if (apiKey) headers['x-cg-demo-api-key'] = apiKey;
        
        const response = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coinId.toLowerCase()}`, { headers });
        if (!response.ok) {
            throw new Error(`CoinGecko API markets responded with status ${response.status}`);
        }
        const data = await response.json();
        const coinData = data?.[0] || {};
        
        const requestedFields = strategy?.coingecko?.endpoints?.["/coins/markets"];
        const result: any = { fallback: false };
        
        if (!requestedFields || requestedFields.includes("current_price")) {
            result.current_price = coinData.current_price || 0;
        }
        if (!requestedFields || requestedFields.includes("market_cap")) {
            result.market_cap = coinData.market_cap || 0;
        }
        if (!requestedFields || requestedFields.includes("total_volume")) {
            result.total_volume = coinData.total_volume || 0;
        }
        if (!requestedFields || requestedFields.includes("price_change_percentage_24h")) {
            result.price_change_percentage_24h = coinData.price_change_percentage_24h || 0;
        }
        
        return result;
    } catch (error) {
        console.error(`[Ingestion Error] fetchCoinGeckoMarkets failed for ${coinId}:`, error);
        return { fallback: true };
    }
}

export async function fetchCoinGeckoMacro(coinId: string, strategy?: DispatcherStrategy) {
    try {
        if (strategy && !strategy.coingecko?.endpoints?.["/coins/{id}"]) {
            console.log("⏭️ [Ingestion] Skipping CoinGecko /coins/{id} fetch (not requested by dispatcher)");
            return { fallback: false, skipped: true };
        }
        
        const apiKey = process.env.COINGECKO_API_KEY;
        const headers: Record<string, string> = { 'Accept': 'application/json' };
        if (apiKey) headers['x-cg-demo-api-key'] = apiKey;
        
        const requestedFields = strategy?.coingecko?.endpoints?.["/coins/{id}"];
        const includeCommunity = !requestedFields || requestedFields.includes("community_data");
        const includeDeveloper = !requestedFields || requestedFields.includes("developer_data");
        
        const response = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId.toLowerCase()}?localization=false&tickers=false&community_data=${includeCommunity}&developer_data=${includeDeveloper}&sparkline=false`, {
            headers
        });
        
        if (!response.ok) {
            throw new Error(`CoinGecko API responded with status ${response.status}`);
        }
        
        const data = await response.json();
        const result: any = { fallback: false };
        
        if (includeCommunity) {
            result.community_data = data?.community_data || {};
        }
        if (includeDeveloper) {
            result.developer_data = data?.developer_data || {};
        }
        
        // Retain for backward compatibility with general macro usage
        result.marketCap = data?.market_data?.market_cap?.usd || 0;
        result.fdv = data?.market_data?.fully_diluted_valuation?.usd || 0;
        result.volume24h = data?.market_data?.total_volume?.usd || 0;
        
        return result;
    } catch (error) {
        console.error(`[Ingestion Error] fetchCoinGeckoMacro failed for ${coinId}:`, error);
        return { fallback: true };
    }
}
