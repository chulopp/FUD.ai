import fs from 'fs';
import path from 'path';

// ==========================================
// STEP 1: LOAD ENV VARIABLES FROM .ENV.LOCAL
// ==========================================
function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const firstEqual = trimmed.indexOf('=');
      if (firstEqual === -1) return;
      const key = trimmed.substring(0, firstEqual).trim();
      const val = trimmed.substring(firstEqual + 1).trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = val;
    });
  }
}
loadEnvLocal();

// Verify key env variables
const rapidKey = process.env.RAPIDAPI_KEY;
console.log(`🔑 Env status: RAPIDAPI_KEY=${rapidKey ? 'LOADED' : 'MISSING'}, DEEPSEEK_API_KEY=${process.env.DEEPSEEK_API_KEY ? 'LOADED' : 'MISSING'}`);

// ==========================================
// STEP 2: SETUP INTERCEPTORS & COST TRACKING
// ==========================================
const deepseekUsage = {
  prompt_tokens: 0,
  completion_tokens: 0,
  cached_tokens: 0
};

const ingestionPayloads = {
  twitter: [],
  telegram: [],
  rugcheck: null,
  goplus: null,
  bybit: null,
  dexscreener: null,
  coingecko: null,
  defillama: null
};

// Global Fetch Interceptor
const originalFetch = global.fetch;
global.fetch = async function(input, init) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const res = await originalFetch(input, init);
  const clone = res.clone();

  try {
    // Intercept DeepSeek completions
    if (url.includes('api.deepseek.com') && init?.method === 'POST') {
      const data = await clone.json();
      if (data.usage) {
        const u = data.usage;
        deepseekUsage.prompt_tokens += u.prompt_tokens || 0;
        deepseekUsage.completion_tokens += u.completion_tokens || 0;
        if (u.prompt_tokens_details?.cached_tokens) {
          deepseekUsage.cached_tokens += u.prompt_tokens_details.cached_tokens;
        }
      }
    }

    // Intercept RapidAPI Twitter
    if (url.includes('twitter-api45.p.rapidapi.com')) {
      const data = await clone.json();
      if (data.timeline) {
        ingestionPayloads.twitter = data.timeline.filter(t => t.type === 'tweet').map(t => ({
          username: t.screen_name,
          text: t.text,
          likes: t.favorites,
          createdAt: t.created_at
        }));
      }
    }

    // Intercept RugCheck
    if (url.includes('rugcheck.xyz')) {
      const data = await clone.json();
      ingestionPayloads.rugcheck = {
        score: data.score,
        risks: data.risks?.map(r => r.name) || [],
        rugged: data.rugged
      };
    }

    // Intercept GoPlus
    if (url.includes('gopluslabs.io')) {
      const data = await clone.json();
      const tokenAddress = Object.keys(data.result || {})[0];
      if (tokenAddress) {
        const details = data.result[tokenAddress];
        ingestionPayloads.goplus = {
          isHoneypot: details.is_honeypot,
          isMintable: details.is_mintable,
          isOpenSource: details.is_open_source
        };
      }
    }

    // Intercept Bybit Tickers (api.bytick.com is the Indonesia-accessible production domain)
    if (url.includes('api.bytick.com') || url.includes('api.bybit.com') || url.includes('api-testnet.bytick.com')) {
      const data = await clone.json();
      const item = data.result?.list?.[0];
      if (item) {
        ingestionPayloads.bybit = {
          symbol: item.symbol,
          lastPrice: item.lastPrice,
          openInterest: item.openInterest,
          fundingRate: item.fundingRate,
        };
      }
    }

    // Intercept DexScreener — covers both v1 token-pairs and legacy /latest/dex endpoints
    if (url.includes('dexscreener.com')) {
      const data = await clone.json();
      // v1 returns array directly; legacy wraps in {pairs: []}
      const pairList = Array.isArray(data) ? data : (data.pairs || []);
      const pair = pairList[0] || data.pair;
      if (pair) {
        ingestionPayloads.dexscreener = {
          endpoint: url.includes('/token-pairs/v1/') ? 'v1_token_pairs' : 'legacy',
          priceUsd: pair.priceUsd,
          liquidityUsd: pair.liquidity?.usd,
          volume24h: pair.volume?.h24,
          pairCreatedAt: pair.pairCreatedAt,
        };
      }
    }

    // Intercept CoinGecko
    if (url.includes('coingecko.com')) {
      const data = await clone.json();
      if (Array.isArray(data)) {
        ingestionPayloads.coingecko = {
          price: data[0]?.current_price,
          marketCap: data[0]?.market_cap,
          priceChange24h: data[0]?.price_change_percentage_24h
        };
      }
    }

    // Intercept DefiLlama
    if (url.includes('defillama.com')) {
      const data = await clone.json();
      if (Array.isArray(data)) {
        ingestionPayloads.defillama = {
          protocolsCount: data.length
        };
      }
    }
  } catch (e) {
    // Interception logging fallback errors silently
  }

  return res;
};

// Console Interceptor for beautiful visual separators
const originalLog = console.log;
console.log = function(...args) {
  const logStr = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');

  if (logStr.includes('[DISPATCHER THINKING PROCESS]:')) {
    originalLog('\n==================== [DISPATCHER ROUTING] ====================');
    originalLog(logStr.replace('[DISPATCHER THINKING PROCESS]:', '').trim());
    return;
  }

  if (logStr.includes('[NORMALIZED_METRICS_PAYLOAD]:')) {
    try {
      const payloadStr = logStr.split('[NORMALIZED_METRICS_PAYLOAD]:')[1].trim();
      const payload = JSON.parse(payloadStr);
      originalLog('\n========== [NORMALIZED DATA PAYLOAD] ==========');
      originalLog(`Resolved quantitative data sent to LLM:`);
      originalLog(`  - Price       : $${payload.priceUsd}`);
      originalLog(`  - 24h Volume  : $${payload.volume24h}`);
      originalLog(`  - Market Cap  : $${payload.marketCap}`);
      originalLog(`  - Liquidity   : $${payload.liquidityUsd !== undefined && payload.liquidityUsd !== null ? `$${payload.liquidityUsd}` : 'N/A'}`);
    } catch (e) {
      originalLog('Failed to parse normalized metrics payload:', e);
    }
    return;
  }

  if (logStr.includes('[Pipeline] Step A complete')) {
    originalLog('\n==================== [INGESTION PAYLOAD] ====================');
    originalLog(`📊 Ingestion sources populated:`);
    if (ingestionPayloads.twitter.length > 0) {
      originalLog(`  - [RapidAPI Twitter]: Fetched ${ingestionPayloads.twitter.length} tweets.`);
      originalLog(`    Snippet: "@${ingestionPayloads.twitter[0].username}: ${ingestionPayloads.twitter[0].text.substring(0, 100)}..."`);
    } else {
      originalLog(`  - [RapidAPI Twitter]: 0 tweets (or skipped).`);
    }
    if (ingestionPayloads.rugcheck) {
      originalLog(`  - [RugCheck Solana]: Score = ${ingestionPayloads.rugcheck.score}, Risks count = ${ingestionPayloads.rugcheck.risks.length}`);
    }
    if (ingestionPayloads.goplus) {
      originalLog(`  - [GoPlus EVM]: Honeypot = ${ingestionPayloads.goplus.isHoneypot}, Mintable = ${ingestionPayloads.goplus.isMintable}`);
    }
    if (ingestionPayloads.bybit) {
      originalLog(`  - [Bybit (api.bytick.com)]: Symbol = ${ingestionPayloads.bybit.symbol}, Price = ${ingestionPayloads.bybit.lastPrice}, OI = ${ingestionPayloads.bybit.openInterest}`);
    } else {
      originalLog(`  - [Bybit]: No data captured (check domain interceptor or symbol not listed)`);
    }
    if (ingestionPayloads.dexscreener) {
      originalLog(`  - [DexScreener (${ingestionPayloads.dexscreener.endpoint})]: Price = $${ingestionPayloads.dexscreener.priceUsd}, Liquidity = $${ingestionPayloads.dexscreener.liquidityUsd}, Created = ${ingestionPayloads.dexscreener.pairCreatedAt ? new Date(ingestionPayloads.dexscreener.pairCreatedAt).toISOString().split('T')[0] : 'unknown'}`);
    } else {
      originalLog(`  - [DexScreener]: Not called or no pairs returned`);
    }
    if (ingestionPayloads.coingecko) {
      originalLog(`  - [CoinGecko Market]: Price = $${ingestionPayloads.coingecko.price}, Cap = $${ingestionPayloads.coingecko.marketCap}`);
    }
    if (ingestionPayloads.defillama) {
      originalLog(`  - [DefiLlama Protocols]: Loaded protocols.`);
    }
    return;
  }

  if (logStr.includes('[Pipeline] Source statuses:')) {
    try {
      const statusStr = logStr.split('[Pipeline] Source statuses:')[1].trim();
      const statuses = JSON.parse(statusStr);
      originalLog('\n========== [SOURCE STATUS REPORT] ==========');
      originalLog('Data availability per source:');
      Object.entries(statuses).forEach(([src, st]) => {
        const icon = st === 'ok' ? '✅' : st === 'error' ? '❌' : st === 'empty' ? '⚠️' : '⏭️';
        originalLog(`  ${icon} ${src}: ${st}`);
      });
    } catch(e) { originalLog(logStr); }
    return;
  }

  if (logStr.includes('FETCH_MORE requested')) {
    originalLog('\n==================== [MCTS FETCH_MORE LOOP] ====================');
    originalLog(`🔄 LLM requested dynamic fetch step: ${logStr}`);
    return;
  }

  if (logStr.includes('[Pipeline] Analysis complete.')) {
    originalLog('\n==================== [FINAL AI VERDICT] ====================');
    originalLog(logStr);
    return;
  }

  originalLog(...args);
};

// Cost Calculator for DeepSeek
function calculateDeepSeekCost() {
  const cacheHit = deepseekUsage.cached_tokens;
  const cacheMiss = Math.max(0, deepseekUsage.prompt_tokens - cacheHit);
  const completion = deepseekUsage.completion_tokens;

  const costCacheHit = (cacheHit * 0.0028) / 1000000;
  const costCacheMiss = (cacheMiss * 0.14) / 1000000;
  const costCompletion = (completion * 0.28) / 1000000;
  const totalCost = costCacheHit + costCacheMiss + costCompletion;

  return {
    cacheHit,
    cacheMiss,
    completion,
    totalCost: totalCost.toFixed(6)
  };
}

// ==========================================
// STEP 3: DEFINE SCENARIOS & RUNNER
// ==========================================
import { executeFudAnalysis } from '../app/lib/mcts/pipeline';

const scenarios = [
  {
    id: 1,
    name: "Solana FUD Scenario",
    query: "Analyze $WIF on Solana. Are there any critical vulnerabilities in the contract and what is the current Twitter/Telegram sentiment?",
    symbol: "WIF",
    address: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    chainId: "solana"
  },
  {
    id: 2,
    name: "EVM Fundamental Scenario",
    query: "Check $PEPE on Ethereum. Is it a honeypot? Also, how is the macro TVL holding up?",
    symbol: "PEPE",
    address: "0x6982508145554ce3b5901a7778ad28a500216222",
    chainId: "1"
  },
  {
    id: 3,
    name: "Ambiguous Query (Forced ReAct / FetchMore Loop)",
    query: "Should I buy $TRUMP? I heard rumors about the dev team selling.",
    symbol: "TRUMP",
    address: "",
    chainId: ""
  },
  {
    id: 4,
    name: "Native L1 / Macro Scenario",
    query: "Analyze the current market structure for Bitcoin. Are whales accumulating, and what is the general mood on Twitter and Telegram?",
    symbol: "BTC",
    address: "native",
    chainId: "native"
  }
];

async function runTestCases() {
  console.log("\n🚀 Starting White-Box Intelligence Test Case Suite...\n");

  for (const tc of scenarios) {
    // Reset ingestion logs for this run
    ingestionPayloads.twitter = [];
    ingestionPayloads.rugcheck = null;
    ingestionPayloads.goplus = null;
    ingestionPayloads.bybit = null;
    ingestionPayloads.dexscreener = null;
    ingestionPayloads.coingecko = null;
    ingestionPayloads.defillama = null;

    console.log(`\n\n=== RUNNING SCENARIO ${tc.id}: ${tc.name} ===`);
    console.log(`Query: "${tc.query}"`);
    console.log(`Inputs: Symbol=${tc.symbol}, Address=${tc.address || 'none'}, ChainId=${tc.chainId || 'none'}`);

    try {
      const verdict = await executeFudAnalysis(tc.symbol, tc.address, tc.chainId);

      // ── Pipeline status check ───────────────────────────────
      if (verdict.status === 'degraded') {
        originalLog('\n🚨 ========== [DEGRADED PIPELINE STATUS] ==========');
        originalLog(`Pipeline status: DEGRADED — ${verdict.reason || 'unknown reason'}`);
        originalLog(`Executable verdict: ${verdict.executable_verdict}`);
        originalLog(`Confidence: ${verdict.confidence} (null = unusable)`);
        originalLog('This is NOT a valid analysis result — bot clients should NOT act on this.');
      }

      // ── MCTS branches ──────────────────────────────────────
      if (verdict.branch_probabilities && Object.keys(verdict.branch_probabilities).length > 0) {
        originalLog('\n========== [MCTS EXPLORATION BRANCHES] ==========');
        originalLog('Branches evaluated with probabilities:');
        Object.entries(verdict.branch_probabilities).forEach(([branch, prob]) => {
          originalLog(`  - ${branch}: ${(prob * 100).toFixed(1)}%`);
        });
      }

      // ── Step summary (multi-step proof) ─────────────────────
      if (verdict.step_summary) {
        originalLog('\n========== [MULTI-STEP REASONING LOG] ==========');
        originalLog(`Total LLM calls: ${verdict.step_summary.total_steps} (min 5 required for valid analysis)`);
        originalLog(`Total tokens: ${verdict.step_summary.total_input_tokens}in / ${verdict.step_summary.total_output_tokens}out`);
        originalLog(`Estimated cost: $${verdict.step_summary.estimated_cost_usd}`);
        verdict.step_summary.steps.forEach((s, i) => {
          originalLog(`  Step ${i+1}: [${s.step_name}] ${s.input_tokens}in/${s.output_tokens}out — ${s.execution_time_ms}ms`);
        });
      }

      // ── drama_index breakdown ───────────────────────────────
      originalLog(`\n========== [DRAMA INDEX BREAKDOWN] ==========`);
      originalLog(`  chatter_level (social noise):  ${verdict.chatter_level}/100`);
      originalLog(`  risk_score (on-chain threat):   ${verdict.risk_score}/100`);
      originalLog(`  drama_index (0.4*c + 0.6*r):   ${verdict.drama_index}/100`);

      originalLog('\nResult Payload:\n', JSON.stringify(verdict, null, 2));
    } catch (e) {
      console.error(`❌ Scenario ${tc.id} failed with error:`, e);
    }

    console.log(`\n--- Done Scenario ${tc.id}. Waiting 5 seconds before next run... ---`);
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // Cost and summary report
  const metrics = calculateDeepSeekCost();
  console.log(`\n\n============================================================`);
  console.log(`🏁 INTEL TEST COMPLETE — DEEPSEEK TOKEN COSTS`);
  console.log(`============================================================`);
  console.log(`DeepSeek Model: deepseek-v4-flash`);
  console.log(`Input Tokens (Cache Hit)  : ${metrics.cacheHit}`);
  console.log(`Input Tokens (Cache Miss) : ${metrics.cacheMiss}`);
  console.log(`Output Tokens             : ${metrics.completion}`);
  console.log(`------------------------------------------------------------`);
  console.log(`Estimated API Cost        : $${metrics.totalCost} USD`);
  console.log(`============================================================\n`);
}

runTestCases().catch(e => {
  console.error("Fatal test runner error:", e);
  process.exit(1);
});
