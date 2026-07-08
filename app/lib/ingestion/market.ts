import crypto from 'crypto';
import { DispatcherStrategy } from '../mcts/dispatcher';
import { fetchWithTimeout } from '../utils/fetch-with-timeout';
import { redis } from '../redis/client';
import {
  type IngestionResult,
  type BybitOrderBookData,
  type BybitTickerData,
  type DexScreenerData,
  type DefiLlamaData,
  type CoinGeckoMarketsData,
  type CoinGeckoMacroData,
  ok,
  empty,
  ingestionError,
  notCalled,
} from './types';

// ─────────────────────────────────────────────────────────────
// Bybit Domain Configuration
//
// api.bybit.com is blocked by Indonesian ISPs — we use api.bytick.com
// as the production mainnet endpoint instead (same API, different domain).
// api-testnet.bytick.com is available for local dev / CI via BYBIT_BASE_URL.
//
// Priority: BYBIT_BASE_URL env var → api.bytick.com (mainnet)
// ─────────────────────────────────────────────────────────────
const BYBIT_BASE_URL = process.env.BYBIT_BASE_URL || 'https://api.bytick.com';

/**
 * Generates HMAC signature headers for the Bybit API.
 * 
 * SECURITY AUDIT NOTE (MEDIUM-02): Bybit authentication keys and secrets
 * are sent EXCLUSIVELY via headers. They are NEVER appended to query params
 * or URL paths, avoiding leakages in CDN, server-side, or proxy request logs.
 * Do not log headers in production observability.
 */
function generateBybitHeaders(
  apiKey: string | undefined,
  apiSecret: string | undefined,
  payload: string = ''
): Record<string, string> {
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
    };
}

// ─────────────────────────────────────────────────────────────
// Bybit Order Book
// ─────────────────────────────────────────────────────────────
export async function fetchBybitOrderBook(
  symbol: string,
  strategy?: DispatcherStrategy
): Promise<IngestionResult<BybitOrderBookData>> {
    if (strategy && !strategy.bybit_v5?.endpoints?.['/v5/market/orderbook']) {
        console.log('⏭️ [Ingestion] Skipping Bybit Order Book fetch (not requested by dispatcher)');
        return notCalled<BybitOrderBookData>();
    }

    const apiKey = process.env.BYBIT_API_KEY;
    const apiSecret = process.env.BYBIT_API_SECRET;

    const qs = `category=spot&symbol=${symbol}`;
    const headers = generateBybitHeaders(apiKey, apiSecret, qs);

    try {
        const response = await fetchWithTimeout(`${BYBIT_BASE_URL}/v5/market/orderbook?${qs}`, { headers }, 10_000);

        if (!response.ok) {
            return ingestionError<BybitOrderBookData>(`Bybit API responded with status ${response.status}`);
        }

        const data = await response.json();
        const orderbookData = data?.result || { b: [], a: [] };

        const requestedFields = strategy?.bybit_v5?.endpoints?.['/v5/market/orderbook'];
        const result: BybitOrderBookData = { b: [], a: [] };

        if (!requestedFields || requestedFields.includes('a (asks)')) {
            result.a = orderbookData.a || [];
        }
        if (!requestedFields || requestedFields.includes('b (bids)')) {
            result.b = orderbookData.b || [];
        }

        const hasData = result.a.length > 0 || result.b.length > 0;
        return hasData ? ok<BybitOrderBookData>(result) : empty<BybitOrderBookData>();
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[Ingestion Error] fetchBybitOrderBook failed for ${symbol}:`, msg);
        return ingestionError<BybitOrderBookData>(msg);
    }
}

// ─────────────────────────────────────────────────────────────
// Bybit Perpetuals / Tickers
// ─────────────────────────────────────────────────────────────
export async function fetchBybitPerpetuals(
  symbol: string,
  strategy?: DispatcherStrategy
): Promise<IngestionResult<BybitTickerData>> {
    if (strategy && !strategy.bybit_v5?.endpoints?.['/v5/market/tickers']) {
        console.log('⏭️ [Ingestion] Skipping Bybit Tickers fetch (not requested by dispatcher)');
        return notCalled<BybitTickerData>();
    }

    const apiKey = process.env.BYBIT_API_KEY;
    const apiSecret = process.env.BYBIT_API_SECRET;

    const qs = `category=linear&symbol=${symbol}`;
    const headers = generateBybitHeaders(apiKey, apiSecret, qs);

    try {
        const response = await fetchWithTimeout(`${BYBIT_BASE_URL}/v5/market/tickers?${qs}`, { headers }, 10_000);

        if (!response.ok) {
            return ingestionError<BybitTickerData>(`Bybit API responded with status ${response.status}`);
        }

        const data = await response.json();
        const item = data?.result?.list?.[0];

        if (!item) {
            return empty<BybitTickerData>();
        }

        const requestedFields = strategy?.bybit_v5?.endpoints?.['/v5/market/tickers'];
        const result: BybitTickerData = {};

        if (!requestedFields || requestedFields.includes('lastPrice')) result.lastPrice = item.lastPrice || '0';
        if (!requestedFields || requestedFields.includes('price24hPcnt')) result.price24hPcnt = item.price24hPcnt || '0';
        if (!requestedFields || requestedFields.includes('volume24h')) result.volume24h = item.volume24h || '0';
        if (!requestedFields || requestedFields.includes('bid1Price')) result.bid1Price = item.bid1Price || '0';
        if (!requestedFields || requestedFields.includes('ask1Price')) result.ask1Price = item.ask1Price || '0';

        // Always include for ReAct compatibility
        result.openInterest = item.openInterest || '0';
        result.fundingRate = item.fundingRate || '0';

        return ok<BybitTickerData>(result);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[Ingestion Error] fetchBybitPerpetuals failed for ${symbol}:`, msg);
        return ingestionError<BybitTickerData>(msg);
    }
}

// ─────────────────────────────────────────────────────────────
// DexScreener Data — ALWAYS called for valid contract addresses
//
// Strategy: NOT gated by dispatcher. If a contract address is provided,
// DexScreener is always called. Liquidity must never default to $0
// without explicit status=error in the result.
//
// Endpoint priority:
//   1. /token-pairs/v1/{chainSlug}/{address} — DexScreener v1 (best for Solana)
//   2. /latest/dex/tokens/{address}          — legacy fallback
//   3. /latest/dex/search?q={address}        — last resort
// ─────────────────────────────────────────────────────────────

/** Maps chain IDs to DexScreener chain slugs for the v1 token-pairs endpoint. */
function resolveChainSlug(chainId?: string): string | null {
    if (!chainId) return null;
    const lower = chainId.toLowerCase();

    // Solana
    if (lower === 'solana') return 'solana';
    // EVM numeric IDs
    const evmMap: Record<string, string> = {
        '1': 'ethereum',
        '56': 'bsc',
        '137': 'polygon',
        '42161': 'arbitrum',
        '8453': 'base',
        '43114': 'avalanche',
        '10': 'optimism',
        '250': 'fantom',
        '25': 'cronos',
    };
    if (evmMap[lower]) return evmMap[lower];

    // Native / non-contract assets — no chain slug
    if (lower === 'native' || lower === '') return null;

    return null;
}

export async function fetchDexScreenerData(
  contractAddress: string,
  chainId?: string
): Promise<IngestionResult<DexScreenerData>> {
    // Not gated by dispatcher strategy — always called for valid addresses
    try {
        const addrLower = contractAddress.toLowerCase();
        const missKey = `ingestion:dexscreener_miss:${addrLower}:${chainId || 'any'}`;

        // Check negative cache first (HIGH-02)
        try {
            const hasMiss = await redis.get<string>(missKey);
            if (hasMiss) {
                console.log(`⏭️ [DexScreener] Negative cache hit for ${contractAddress} (miss cached) — returning empty.`);
                return empty<DexScreenerData>();
            }
        } catch (err) {
            console.warn('[DexScreener] Failed to read negative cache:', err);
        }

        const chainSlug = resolveChainSlug(chainId);
        let pairs: any[] | null = null;

        // Attempt 1: DexScreener v1 token-pairs endpoint (chain-aware, best quality)
        if (chainSlug) {
            try {
                const v1Url = `https://api.dexscreener.com/token-pairs/v1/${chainSlug}/${contractAddress}`;
                console.log(`🔎 [DexScreener] Trying v1 endpoint: ${v1Url}`);
                const v1Res = await fetchWithTimeout(v1Url, undefined, 10_000);
                if (v1Res.ok) {
                    const v1Data = await v1Res.json();
                    // v1 returns an array directly
                    if (Array.isArray(v1Data) && v1Data.length > 0) {
                        pairs = v1Data;
                        console.log(`✅ [DexScreener] v1 returned ${pairs.length} pairs for ${contractAddress}`);
                    }
                }
            } catch (e) {
                console.warn('[DexScreener] v1 endpoint failed, trying legacy:', e);
            }
        }

        // Attempt 2: Legacy tokens endpoint
        if (!pairs || pairs.length === 0) {
            const legacyRes = await fetchWithTimeout(`https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`, undefined, 10_000);
            if (legacyRes.ok) {
                const legacyData = await legacyRes.json();
                if (legacyData?.pairs?.length > 0) {
                    pairs = legacyData.pairs;
                }
            }
        }

        // Attempt 3: Search fallback
        if (!pairs || pairs.length === 0) {
            console.log(`⚠️ [DexScreener] No pairs found via primary endpoints, trying search...`);
            const searchRes = await fetchWithTimeout(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(contractAddress)}`, undefined, 10_000);
            if (searchRes.ok) {
                const searchData = await searchRes.json();
                if (searchData?.pairs?.length > 0) {
                    pairs = searchData.pairs;
                }
            }
        }

        if (!pairs || pairs.length === 0) {
            // Write negative cache to Redis for 60 seconds (HIGH-02)
            try {
                await redis.set(missKey, "empty", { ex: 60 });
                console.log(`[DexScreener] Cached miss for ${contractAddress} in Redis for 60s`);
            } catch (err) {
                console.warn('[DexScreener] Failed to write negative cache:', err);
            }
            return empty<DexScreenerData>();
        }

        // Sort by liquidity descending — use the most liquid pair
        pairs.sort((a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
        const pair = pairs[0];

        const result: DexScreenerData = {
            priceUsd: pair.priceUsd || '0',
            volume24h: pair.volume?.h24 || 0,
            fdv: pair.fdv || 0,
            liquidityUsd: pair.liquidity?.usd || 0,
            marketCap: pair.marketCap || 0,
            priceChange24h: pair.priceChange?.h24 || 0,
            pairCreatedAt: pair.pairCreatedAt || undefined,
            txns24h: pair.txns?.h24 || undefined,
        };

        console.log(`✅ [DexScreener] Got liquidity $${result.liquidityUsd} for ${contractAddress}`);
        return ok<DexScreenerData>(result);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[Ingestion Error] fetchDexScreenerData failed for ${contractAddress}:`, msg);
        return ingestionError<DexScreenerData>(msg);
    }
}

// ─────────────────────────────────────────────────────────────
// DefiLlama
// ─────────────────────────────────────────────────────────────
export async function fetchDefiLlamaProtocols(
  coinSymbol: string,
  strategy?: DispatcherStrategy
): Promise<IngestionResult<DefiLlamaData>> {
    if (strategy && !strategy.defillama?.endpoints?.['/protocols']) {
        console.log('⏭️ [Ingestion] Skipping DefiLlama fetch (not requested by dispatcher)');
        return notCalled<DefiLlamaData>();
    }

    try {
        // CRITICAL-02 fix: use /protocol/{slug} (single-protocol endpoint, ~1-5KB)
        // instead of /protocols (full dump, ~2-5MB per request).
        // Slug is derived as coinSymbol.toLowerCase(); a 404 means the protocol
        // is not indexed by that slug — return empty (same as a .find() miss).
        const slug = coinSymbol.toLowerCase();
        const response = await fetchWithTimeout(`https://api.llama.fi/protocol/${slug}`, undefined, 10_000);

        if (response.status === 404) {
            console.log(`ℹ️ [DefiLlama] Protocol slug "${slug}" not found (404) — returning empty.`);
            return empty<DefiLlamaData>();
        }
        if (!response.ok) {
            return ingestionError<DefiLlamaData>(`DefiLlama API responded with status ${response.status}`);
        }

        const protocol = await response.json();
        if (!protocol || typeof protocol !== 'object') {
            return empty<DefiLlamaData>();
        }

        const requestedFields = strategy?.defillama?.endpoints?.['/protocols'];
        const result: DefiLlamaData = {};

        if (!requestedFields || requestedFields.includes('tvl')) result.tvl = protocol.tvl || 0;
        if (!requestedFields || requestedFields.includes('change_1d')) result.change_1d = protocol.change_1d || 0;
        if (!requestedFields || requestedFields.includes('change_7d')) result.change_7d = protocol.change_7d || 0;

        return ok<DefiLlamaData>(result);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[Ingestion Error] fetchDefiLlamaProtocols failed for ${coinSymbol}:`, msg);
        return ingestionError<DefiLlamaData>(msg);
    }
}

// ─────────────────────────────────────────────────────────────
// CoinGecko — ID resolution with caching
// ─────────────────────────────────────────────────────────────
const coingeckoIdCache = new Map<string, string>();

async function resolveCoinGeckoId(symbol: string): Promise<string> {
    const trimmed = symbol.trim();
    if (!trimmed) return '';
    const norm = trimmed.toUpperCase();
    if (coingeckoIdCache.has(norm)) {
        return coingeckoIdCache.get(norm)!;
    }

    // Try Redis cache first (HIGH-01)
    const redisKey = `coingecko_id:${norm}`;
    try {
        const cachedId = await redis.get<string>(redisKey);
        if (cachedId) {
            coingeckoIdCache.set(norm, cachedId);
            console.log(`ℹ️ [Ingestion] Resolved CoinGecko ID for "${trimmed}" from Redis: "${cachedId}"`);
            return cachedId;
        }
    } catch (err) {
        console.warn('[Ingestion] Failed to read CoinGecko ID from Redis cache:', err);
    }

    try {
        const apiKey = process.env.COINGECKO_API_KEY;
        const headers: Record<string, string> = { 'Accept': 'application/json' };
        if (apiKey) headers['x-cg-demo-api-key'] = apiKey;

        const response = await fetchWithTimeout(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(trimmed)}`, { headers }, 10_000);
        if (!response.ok) {
            throw new Error(`CoinGecko search failed with status ${response.status}`);
        }
        const data = await response.json();
        const coins = data?.coins || [];
        if (coins.length === 0) {
            return trimmed.toLowerCase();
        }

        const normSymbol = trimmed.toUpperCase();
        const exactMatches = coins.filter((c: any) =>
            (c.symbol && c.symbol.toUpperCase() === normSymbol) ||
            (c.name && c.name.toUpperCase() === normSymbol) ||
            (c.id && c.id.toUpperCase() === normSymbol)
        );

        let resolvedId = trimmed.toLowerCase();
        if (exactMatches.length > 0) {
            exactMatches.sort((a: any, b: any) => {
                const rankA = a.market_cap_rank !== null && a.market_cap_rank !== undefined ? a.market_cap_rank : Infinity;
                const rankB = b.market_cap_rank !== null && b.market_cap_rank !== undefined ? b.market_cap_rank : Infinity;
                return rankA - rankB;
            });
            resolvedId = exactMatches[0].id;
        } else {
            resolvedId = coins[0].id || trimmed.toLowerCase();
        }

        coingeckoIdCache.set(norm, resolvedId);
        console.log(`ℹ️ [Ingestion] Resolved CoinGecko ID for "${trimmed}" to "${resolvedId}"`);

        // Write resolved ID to Redis with 1-hour TTL (HIGH-01)
        try {
            await redis.set(redisKey, resolvedId, { ex: 3600 });
        } catch (err) {
            console.warn('[Ingestion] Failed to write CoinGecko ID to Redis cache:', err);
        }

        return resolvedId;
    } catch (error) {
        console.error(`[Ingestion Error] resolveCoinGeckoId failed for ${symbol}:`, error);
        return trimmed.toLowerCase();
    }
}

export async function fetchCoinGeckoMarkets(
  coinIdOrSymbol: string,
  strategy?: DispatcherStrategy
): Promise<IngestionResult<CoinGeckoMarketsData>> {
    if (strategy && !strategy.coingecko?.endpoints?.['/coins/markets']) {
        console.log('⏭️ [Ingestion] Skipping CoinGecko markets fetch (not requested by dispatcher)');
        return notCalled<CoinGeckoMarketsData>();
    }

    try {
        const resolvedId = await resolveCoinGeckoId(coinIdOrSymbol);
        const apiKey = process.env.COINGECKO_API_KEY;
        const headers: Record<string, string> = { 'Accept': 'application/json' };
        if (apiKey) headers['x-cg-demo-api-key'] = apiKey;

        const response = await fetchWithTimeout(
            `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${resolvedId.toLowerCase()}`,
            { headers },
            10_000
        );
        if (!response.ok) {
            return ingestionError<CoinGeckoMarketsData>(`CoinGecko API markets responded with status ${response.status}`);
        }
        const data = await response.json();
        const coinData = data?.[0];

        if (!coinData) {
            return empty<CoinGeckoMarketsData>();
        }

        const requestedFields = strategy?.coingecko?.endpoints?.['/coins/markets'];
        const result: CoinGeckoMarketsData = {
            current_price: 0,
            market_cap: 0,
            total_volume: 0,
            price_change_percentage_24h: 0,
        };

        if (!requestedFields || requestedFields.includes('current_price')) result.current_price = coinData.current_price || 0;
        if (!requestedFields || requestedFields.includes('market_cap')) result.market_cap = coinData.market_cap || 0;
        if (!requestedFields || requestedFields.includes('total_volume')) result.total_volume = coinData.total_volume || 0;
        if (!requestedFields || requestedFields.includes('price_change_percentage_24h')) result.price_change_percentage_24h = coinData.price_change_percentage_24h || 0;

        return ok<CoinGeckoMarketsData>(result);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[Ingestion Error] fetchCoinGeckoMarkets failed for ${coinIdOrSymbol}:`, msg);
        return ingestionError<CoinGeckoMarketsData>(msg);
    }
}

export async function fetchCoinGeckoMacro(
  coinIdOrSymbol: string,
  strategy?: DispatcherStrategy
): Promise<IngestionResult<CoinGeckoMacroData>> {
    if (strategy && !strategy.coingecko?.endpoints?.['/coins/{id}']) {
        console.log('⏭️ [Ingestion] Skipping CoinGecko /coins/{id} fetch (not requested by dispatcher)');
        return notCalled<CoinGeckoMacroData>();
    }

    try {
        const resolvedId = await resolveCoinGeckoId(coinIdOrSymbol);
        const apiKey = process.env.COINGECKO_API_KEY;
        const headers: Record<string, string> = { 'Accept': 'application/json' };
        if (apiKey) headers['x-cg-demo-api-key'] = apiKey;

        const requestedFields = strategy?.coingecko?.endpoints?.['/coins/{id}'];
        const includeCommunity = !requestedFields || requestedFields.includes('community_data');
        const includeDeveloper = !requestedFields || requestedFields.includes('developer_data');

        const response = await fetchWithTimeout(
            `https://api.coingecko.com/api/v3/coins/${resolvedId.toLowerCase()}?localization=false&tickers=false&community_data=${includeCommunity}&developer_data=${includeDeveloper}&sparkline=false`,
            { headers },
            10_000
        );

        if (!response.ok) {
            return ingestionError<CoinGeckoMacroData>(`CoinGecko API responded with status ${response.status}`);
        }

        const data = await response.json();
        const result: CoinGeckoMacroData = {};

        if (includeCommunity) result.community_data = data?.community_data || {};
        if (includeDeveloper) result.developer_data = data?.developer_data || {};
        result.marketCap = data?.market_data?.market_cap?.usd || 0;
        result.fdv = data?.market_data?.fully_diluted_valuation?.usd || 0;
        result.volume24h = data?.market_data?.total_volume?.usd || 0;

        return ok<CoinGeckoMacroData>(result);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[Ingestion Error] fetchCoinGeckoMacro failed for ${coinIdOrSymbol}:`, msg);
        return ingestionError<CoinGeckoMacroData>(msg);
    }
}
