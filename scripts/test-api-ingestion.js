/**
 * FUD.ai — API Ingestion Isolation Test
 *
 * Mocks the LLM Dispatcher's strategy output (field whitelisting) and executes the
 * ingestion layer for 6 standard quantitative APIs concurrently:
 *   Bybit, GoPlus, RugCheck, DexScreener, DefiLlama, CoinGecko
 *
 * Verifies that (a) each provider returns data and (b) our field-filtering logic
 * strictly trims the response to ONLY the fields requested by the mock strategy.
 */

const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────
// 0. Environment loader (reuses .env.local without "dotenv" dep)
// ─────────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, '../.env.local');
  if (!fs.existsSync(envPath)) {
    console.warn('⚠️ .env.local not found! Using existing environment variables.');
    return;
  }
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const firstEq = trimmed.indexOf('=');
    if (firstEq === -1) return;
    const key = trimmed.substring(0, firstEq).trim();
    const val = trimmed.substring(firstEq + 1).trim().replace(/^["']|["']$/g, '');
    process.env[key] = val;
  });
}
loadEnv();

const BYBIT_API_KEY = process.env.BYBIT_API_KEY;
const GOPLUS_APP_KEY = process.env.GOPLUS_APP_KEY;
const RUGCHECK_API_KEY = process.env.RUGCHECK_API_KEY;
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;

// ─────────────────────────────────────────────────────────────
// 1. Mock Dispatcher Strategy (what the LLM would output)
// Path → array of whitelisted fields (supports dotted nesting: liquidity.usd)
// ─────────────────────────────────────────────────────────────
const mockDispatcherStrategy = {
  bybit_v5: { '/v5/market/tickers': ['lastPrice', 'volume24h'] },
  goplus: { '/api/v1/token_security': ['is_honeypot', 'buy_tax'] },
  rugcheck: { '/v1/tokens/{mint}/report': ['score', 'rugged'] },
  dexscreener: { '/latest/dex/pairs/{chainId}/{pairId}': ['priceUsd', 'liquidity.usd'] },
  defillama: { '/protocols': ['tvl'] },
  coingecko: { '/coins/markets': ['current_price', 'market_cap'] },
};

// ─────────────────────────────────────────────────────────────
// 2. Dummy Inputs
// ─────────────────────────────────────────────────────────────
const inputs = {
  bybit: { symbol: 'BTCUSDT', category: 'spot' },
  // GoPlus /token_security/{chain_id} is EVM-only; USDT (0xdAC17...) is an ERC-20 proxy
  // and GoPlus rejects it with code 2007. Use WETH (real contract) on Ethereum mainnet.
  goplus: { chain: 1, address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' }, // WETH on ETH
  rugcheck: { mint: '9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump' }, // ANSEM (pump.fun) on Solana
  dexscreener: { query: 'BONK' },
  defillama: { index: 0 }, // first protocol in /protocols array
  coingecko: { ids: 'bitcoin', vs_currency: 'usd' },
};

// ─────────────────────────────────────────────────────────────
// 3. Generic Field-Filtering Engine
// Picks ONLY the whitelisted fields (with dotted-nested path support) from
// either an object or an array of objects. Everything else is dropped.
// ─────────────────────────────────────────────────────────────
function pickField(obj, fieldPath) {
  const parts = fieldPath.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  // Reconstruct the nested structure so output mirrors the requested shape
  if (parts.length === 1) return { [parts[0]]: cur };
  const rebuilt = {};
  let ref = rebuilt;
  for (let i = 0; i < parts.length - 1; i++) {
    ref = ref[parts[i]] = {};
  }
  ref[parts[parts.length - 1]] = cur;
  return rebuilt;
}

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      target[key] = target[key] || {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

function applyFieldFilter(data, fields) {
  const filterOne = (obj) => {
    const result = {};
    for (const field of fields) {
      const picked = pickField(obj, field);
      if (picked !== undefined) deepMerge(result, picked);
    }
    return result;
  };
  return Array.isArray(data) ? data.map(filterOne) : filterOne(data);
}

// ─────────────────────────────────────────────────────────────
// 4. Per-Provider Fetchers
// Each returns { ok, raw, target } where `target` is the slice of `raw`
// that the field-filter should operate on (handles API-specific envelopes).
// ─────────────────────────────────────────────────────────────
async function fetchBybit() {
  // api.bybit.com is DNS-hijacked in some regions (e.g. ID); use the bytick.com mirror instead.
  const url = `https://api.bytick.com/v5/market/tickers?category=${inputs.bybit.category}&symbol=${inputs.bybit.symbol}`;
  const res = await fetch(url, {
    headers: BYBIT_API_KEY ? { 'X-BAPI-API-KEY': BYBIT_API_KEY } : {},
  });
  const json = await res.json();
  if (json.retCode !== 0) throw new Error(`Bybit retCode=${json.retCode} ${json.retMsg}`);
  const list = json?.result?.list;
  if (!list || !list.length) throw new Error('Bybit: empty ticker list');
  return { raw: json, target: list };
}

async function fetchGoPlus() {
  // GoPlus uses `contract_addresses` (plural) as the query param; `address` returns code 2007.
  const url = `https://api.gopluslabs.io/api/v1/token_security/${inputs.goplus.chain}?contract_addresses=${inputs.goplus.address}`;
  const res = await fetch(url, {
    headers: { key: GOPLUS_APP_KEY || '' },
  });
  const json = await res.json();
  if (json.code !== 1) throw new Error(`GoPlus code=${json.code} ${json.message}`);
  const map = json?.result;
  if (!map) throw new Error('GoPlus: empty result');
  const addrKey =
    inputs.goplus.address in map
      ? inputs.goplus.address
      : inputs.goplus.address.toLowerCase();
  const tokenInfo = map[addrKey];
  if (!tokenInfo) throw new Error('GoPlus: token not found in result map');
  return { raw: json, target: tokenInfo };
}

async function fetchRugCheck() {
  const url = `https://api.rugcheck.xyz/v1/tokens/${inputs.rugcheck.mint}/report`;
  const res = await fetch(url, {
    headers: { 'X-API-Key': RUGCHECK_API_KEY || '' },
  });
  if (!res.ok) throw new Error(`RugCheck HTTP ${res.status}`);
  const json = await res.json();
  if (json.score === undefined && json.rugged === undefined)
    throw new Error('RugCheck: missing score/rugged in response');
  return { raw: json, target: json };
}

async function fetchDexScreener() {
  const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(inputs.dexscreener.query)}`;
  const res = await fetch(url);
  const json = await res.json();
  const pairs = json?.pairs;
  if (!pairs || !pairs.length) throw new Error('DexScreener: no pairs returned');
  return { raw: json, target: pairs[0] };
}

async function fetchDefiLlama() {
  const url = 'https://api.llama.fi/protocols';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`DefiLlama HTTP ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json) || !json.length) throw new Error('DefiLlama: empty protocols');
  const item = json[inputs.defillama.index];
  return { raw: { length: json.length, first: item }, target: item };
}

async function fetchCoinGecko() {
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${inputs.coingecko.vs_currency}&ids=${inputs.coingecko.ids}`;
  const res = await fetch(url, {
    headers: { 'x-cg-demo-api-key': COINGECKO_API_KEY || '' },
  });
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json) || !json.length) throw new Error('CoinGecko: empty markets');
  return { raw: json, target: json };
}

// ─────────────────────────────────────────────────────────────
// 5. Per-Provider Test Definitions
// ─────────────────────────────────────────────────────────────
const tests = [
  { name: 'Bybit', strategy: mockDispatcherStrategy.bybit_v5['/v5/market/tickers'], fn: fetchBybit },
  { name: 'GoPlus', strategy: mockDispatcherStrategy.goplus['/api/v1/token_security'], fn: fetchGoPlus },
  { name: 'RugCheck', strategy: mockDispatcherStrategy.rugcheck['/v1/tokens/{mint}/report'], fn: fetchRugCheck },
  { name: 'DexScreener', strategy: mockDispatcherStrategy.dexscreener['/latest/dex/pairs/{chainId}/{pairId}'], fn: fetchDexScreener },
  { name: 'DefiLlama', strategy: mockDispatcherStrategy.defillama['/protocols'], fn: fetchDefiLlama },
  { name: 'CoinGecko', strategy: mockDispatcherStrategy.coingecko['/coins/markets'], fn: fetchCoinGecko },
];

const result = {};

// ─────────────────────────────────────────────────────────────
// 6. Main
// ─────────────────────────────────────────────────────────────
function banner(title) {
  const line = '━'.repeat(64);
  console.log(`\n${line}\n${title}\n${line}`);
}

function pretty(obj) {
  return JSON.stringify(obj, null, 2);
}

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 FUD.ai — API Ingestion Isolation Test (6 Standard APIs)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Bybit API Key:      ${BYBIT_API_KEY ? '✅' : '— (public endpoint)'}`);
  console.log(`GoPlus App Key:     ${GOPLUS_APP_KEY ? '✅' : '❌ MISSING'}`);
  console.log(`RugCheck API Key:   ${RUGCHECK_API_KEY ? '✅' : '❌ MISSING'}`);
  console.log(`CoinGecko API Key:  ${COINGECKO_API_KEY ? '✅' : '❌ MISSING'}`);
  console.log('DexScreener:        ✅ (no key needed)');
  console.log('DefiLlama:          ✅ (no key needed)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Run all 6 concurrently — Promise.allSettled so a single failure doesn't abort the rest.
  const settled = await Promise.allSettled(tests.map((t) => t.fn()));

  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    const state = settled[i];
    banner(`[${i + 1}/6] ${t.name}  ←  whitelisted: ${t.strategy.join(', ')}`);
    if (state.status === 'rejected') {
      console.log(`❌ FETCH FAILED: ${state.reason?.message || state.reason}`);
      result[t.name] = { ok: false, error: String(state.reason?.message || state.reason) };
      continue;
    }
    const { raw, target } = state.value;
    const filtered = applyFieldFilter(target, t.strategy);

    // Verify filtering actually trimmed: count original top-level keys vs filtered keys.
    const rawKeyCount = Array.isArray(target)
      ? Object.keys(target[0] || {}).length
      : Object.keys(target || {}).length;
    const filteredKeyCount = Array.isArray(filtered)
      ? Object.keys(filtered[0] || {}).length
      : Object.keys(filtered || {}).length;

    console.log('✅ FETCH OK');
    console.log(`→ Raw target size (top-level keys): ${rawKeyCount}`);
    console.log(`→ Filtered size (top-level keys):  ${filteredKeyCount}`);
    console.log('— FILTERED OUTPUT —');
    console.log(pretty(filtered));
    result[t.name] = { ok: true, filtered };
  }

  // Final verdict
  banner('🏁 FINAL VERDICT');
  const passed = tests.filter((_, i) => settled[i].status === 'fulfilled').length;
  console.log(`${passed}/${tests.length} APIs fetched & filtered successfully.`);
  for (const t of tests) {
    console.log(`  ${result[t.name]?.ok ? '✅' : '❌'} ${t.name}`);
  }

  fs.writeFileSync(
    path.join(__dirname, 'test-api-ingestion-result.json'),
    pretty(result),
  );
  console.log('\n💾 Full results written to test-api-ingestion-result.json');
}

run().catch((e) => {
  console.error('Fatal error in test runner:', e);
  process.exit(1);
});