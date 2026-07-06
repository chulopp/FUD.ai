import { 
  fetchBybitOrderBook, 
  fetchBybitPerpetuals, 
  fetchDexScreenerData, 
  fetchDefiLlamaProtocols, 
  fetchCoinGeckoMarkets, 
  fetchCoinGeckoMacro 
} from '../ingestion/market';
import { fetchGoPlusSecurity, fetchRugCheckScore } from '../ingestion/security';
import { fetchTwitterIntel } from '../ingestion/rapidapi_twitter';
import { fetchTelegramIntel } from '../ingestion/telegram';
import { runLightweightEngine, runHeavyweightEngine } from '../llm/engines';
import { runGranularDispatcher } from './dispatcher';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface PipelineContext {
  coinSymbol: string;
  contractAddress?: string;
  chainId: string;
  // Ingestion results
  orderBook: Awaited<ReturnType<typeof fetchBybitOrderBook>>;
  dexData: Awaited<ReturnType<typeof fetchDexScreenerData>>;
  securityGoPlus: Awaited<ReturnType<typeof fetchGoPlusSecurity>>;
  securityRugCheck: Awaited<ReturnType<typeof fetchRugCheckScore>>;
  twitterIntel: { text: string; fallback: boolean };
  telegramIntel: { text: string; fallback: boolean };
  // Dispatcher optional metrics
  coingeckoMarkets?: Awaited<ReturnType<typeof fetchCoinGeckoMarkets>>;
  coingeckoMacro?: Awaited<ReturnType<typeof fetchCoinGeckoMacro>>;
  defillamaProtocols?: Awaited<ReturnType<typeof fetchDefiLlamaProtocols>>;
  // Filtered FUD claims from Lightweight Engine
  fudClaims: string[];
  // Optional: dynamically fetched perps data (ReAct Step D)
  perpData?: Awaited<ReturnType<typeof fetchBybitPerpetuals>>;
}

export interface VerdictResult {
  drama_index: number;
  dominant_branch: string;
  branch_probabilities?: Record<string, number>;
  evidence_chain: string[];
  executable_verdict: 'LIQUIDATE_LONGS' | 'HOLD' | 'ACCUMULATE' | 'IGNORE_FUD';
  confidence?: number;
  served_from_cache: boolean;
  fallback?: boolean;
}

// ─────────────────────────────────────────────────────────────
// System Prompts
// ─────────────────────────────────────────────────────────────

const LIGHTWEIGHT_SYSTEM_PROMPT = `You are a crypto data extractor. Read the social chatter and extract specific FUD claims. Output strictly as a JSON array of strings. Drop spam and irrelevant memes. Example output: ["claim 1", "claim 2"]`;

const HEAVYWEIGHT_SYSTEM_PROMPT = `You are an MCTS evaluator for crypto FUD. Analyze the Market Data, Security Data, and FUD Claims. Create dynamic branches (hypotheses) based on the complexity of the claims (do not hardcode to 3 branches; create as many as logically necessary). Evaluate each branch against the on-chain data.

You MUST respond with a single valid JSON object only. Do NOT output markdown code blocks (e.g. \`\`\`json), do NOT include any introductory or concluding text. Return only the JSON structure.

You have TWO output options:

OPTION 1 (Need more data): {"action": "FETCH_MORE", "target": "describe missing on-chain or perp data needed"}

OPTION 2 (Final Verdict): {"drama_index": <number 0-100>, "dominant_branch": "<branch_name>", "branch_probabilities": {"<branch>": <0-1>}, "evidence_chain": ["<evidence>"], "executable_verdict": "<LIQUIDATE_LONGS|HOLD|ACCUMULATE|IGNORE_FUD>", "confidence": <0-1>}`;

const CONCLUSION_FORCED_SUFFIX = `\n\nCONCLUSION FORCED: You have already requested more data. You MUST now output OPTION 2 — the Final Verdict JSON — immediately. Do not output FETCH_MORE again.`;

// ─────────────────────────────────────────────────────────────
// Safe JSON parser
// ─────────────────────────────────────────────────────────────

function safeParseJSON(raw: string): Record<string, unknown> | null {
  try {
    // Strip markdown fences if present
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    return JSON.parse(cleaned);
  } catch {
    // Attempt to extract first {...} block
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// ReAct: Dynamic Fetch Handler (Step D)
// ─────────────────────────────────────────────────────────────

async function handleDynamicFetch(
  target: string,
  context: PipelineContext
): Promise<string> {
  console.log("🔄 [ReAct] Dynamic Fetch triggered for target:", target);
  const t = target.toLowerCase();
  try {
    if (t.includes('perp') || t.includes('open interest') || t.includes('funding')) {
      // Fetch without strategy parameter to bypass dispatcher filtering for dynamic ReAct fetching
      const perpData = await fetchBybitPerpetuals(context.coinSymbol + 'USDT');
      return `Perpetuals data for ${context.coinSymbol}: Open Interest = ${perpData.openInterest}, Funding Rate = ${perpData.fundingRate}`;
    }
    if (t.includes('liquidity') || t.includes('dex') || t.includes('volume')) {
      if (!context.contractAddress || context.contractAddress.toLowerCase() === 'native') {
        return `DEX data: Liquidity = $0 (Native token, no DEX pools searched), 24h Volume = $0, Price = $0`;
      }
      // Fetch without strategy parameter to bypass dispatcher filtering for dynamic ReAct fetching
      const dex = await fetchDexScreenerData(context.contractAddress);
      return `DEX data: Liquidity = $${dex.liquidityUsd}, 24h Volume = $${dex.volume24h}, Price = $${dex.priceUsd}`;
    }
    // Requested data type not supported
    return `DATA_UNAVAILABLE: ${target}. Proceed with existing context.`;
  } catch (error) {
    console.error('[Pipeline] handleDynamicFetch error:', error);
    return `DATA_UNAVAILABLE: Fetch failed for "${target}". Proceed with existing context.`;
  }
}

// ─────────────────────────────────────────────────────────────
// MCTS Evaluator with ReAct (Step C + D)
// ─────────────────────────────────────────────────────────────

async function evaluateMCTS(
  context: PipelineContext,
  iteration: number = 0
): Promise<VerdictResult> {
  console.log("⚖️ [STEP C] Heavyweight Engine (DeepSeek) MCTS reasoning started...");
  const FALLBACK_VERDICT: VerdictResult = {
    drama_index: 0,
    dominant_branch: 'unknown',
    branch_probabilities: {},
    evidence_chain: ['Pipeline failed to produce a verdict.'],
    executable_verdict: 'IGNORE_FUD',
    confidence: 0,
    served_from_cache: false,
    fallback: true,
  };

  try {
    const userPrompt = `
COIN: ${context.coinSymbol}
CONTRACT: ${context.contractAddress} (Chain ID: ${context.chainId})

=== MARKET DATA (Spot Order Book) ===
Bids (top 3): ${JSON.stringify(context.orderBook.b?.slice(0, 3) ?? [])}
Asks (top 3): ${JSON.stringify(context.orderBook.a?.slice(0, 3) ?? [])}

=== DEX DATA ===
Liquidity: $${context.dexData.liquidityUsd}
24h Volume: $${context.dexData.volume24h}
FDV: $${context.dexData.fdv}
Price: $${context.dexData.priceUsd}

=== SECURITY DATA ===
GoPlus — Honeypot: ${context.securityGoPlus.isHoneypot}, Mintable: ${context.securityGoPlus.isMintable}, Open Source: ${context.securityGoPlus.isOpenSource}
RugCheck — Risk Score: ${context.securityRugCheck.score}, Risk Flags: ${context.securityRugCheck.risks}, Is Rug: ${context.securityRugCheck.isRug}

${context.coingeckoMarkets ? `=== COINGECKO MARKETS ===
Price: ${context.coingeckoMarkets.current_price || "N/A"}
Market Cap: ${context.coingeckoMarkets.market_cap || "N/A"}
Total Volume: ${context.coingeckoMarkets.total_volume || "N/A"}
Price Change 24h: ${context.coingeckoMarkets.price_change_percentage_24h || "N/A"}%` : ''}

${context.coingeckoMacro ? `=== COINGECKO MACRO & METRICS ===
Community Followers / Activity: ${JSON.stringify(context.coingeckoMacro.community_data || "N/A")}
Developer Commits / Activity: ${JSON.stringify(context.coingeckoMacro.developer_data || "N/A")}` : ''}

${context.defillamaProtocols ? `=== DEFILLAMA TVL ===
TVL: $${context.defillamaProtocols.tvl || "N/A"}
Change 1d: ${context.defillamaProtocols.change_1d || "N/A"}%
Change 7d: ${context.defillamaProtocols.change_7d || "N/A"}%` : ''}

=== FUD CLAIMS (Social Intel) ===
${context.fudClaims.length > 0 ? context.fudClaims.map((c, i) => `${i + 1}. ${c}`).join('\n') : 'No specific FUD claims detected.'}

${context.perpData ? `=== PERPETUALS DATA (Dynamically Fetched) ===
Open Interest: ${context.perpData.openInterest}
Funding Rate: ${context.perpData.fundingRate}` : ''}

${iteration >= 1 ? CONCLUSION_FORCED_SUFFIX : ''}
`.trim();

    const systemPrompt = iteration >= 1
      ? HEAVYWEIGHT_SYSTEM_PROMPT + CONCLUSION_FORCED_SUFFIX
      : HEAVYWEIGHT_SYSTEM_PROMPT;

    const raw = await runHeavyweightEngine(systemPrompt, userPrompt);
    const parsed = safeParseJSON(raw);

    if (!parsed) {
      console.error('[MCTS] Failed to parse Heavyweight Engine output:', raw);
      return FALLBACK_VERDICT;
    }

    // ── OPTION 1: FETCH_MORE ─────────────────────────────────
    if (parsed.action === 'FETCH_MORE') {
      const target = (parsed.target as string) || 'unknown data';
      console.log(`[MCTS] FETCH_MORE requested (iteration ${iteration}): "${target}"`);

      if (iteration >= 1) {
        // Force conclusion — call engine one more time with forced suffix
        console.warn('[MCTS] Max iterations reached. Forcing conclusion.');
        const forcedRaw = await runHeavyweightEngine(
          HEAVYWEIGHT_SYSTEM_PROMPT + CONCLUSION_FORCED_SUFFIX,
          userPrompt
        );
        const forcedParsed = safeParseJSON(forcedRaw);
        if (forcedParsed && typeof forcedParsed.drama_index === 'number') {
          return buildVerdict(forcedParsed);
        }
        return FALLBACK_VERDICT;
      }

      // Fetch the missing data
      const additionalData = await handleDynamicFetch(target, context);
      const updatedContext: PipelineContext = {
        ...context,
        fudClaims: [
          ...context.fudClaims,
          `[DYNAMIC FETCH RESULT] ${additionalData}`,
        ],
      };

      return evaluateMCTS(updatedContext, 1);
    }

    // ── OPTION 2: Final Verdict ───────────────────────────────
    if (typeof parsed.drama_index === 'number') {
      return buildVerdict(parsed);
    }

    console.error('[MCTS] Unexpected output format from Heavyweight Engine:', parsed);
    return FALLBACK_VERDICT;
  } catch (error) {
    console.error('[MCTS] evaluateMCTS threw an error:', error);
    return FALLBACK_VERDICT;
  }
}

// ─────────────────────────────────────────────────────────────
// Verdict builder — normalizes LLM output to VerdictResult
// ─────────────────────────────────────────────────────────────

const VALID_VERDICTS = new Set(['LIQUIDATE_LONGS', 'HOLD', 'ACCUMULATE', 'IGNORE_FUD']);

function buildVerdict(parsed: Record<string, unknown>): VerdictResult {
  const rawVerdict = String(parsed.executable_verdict ?? 'IGNORE_FUD').toUpperCase();
  const executable_verdict = VALID_VERDICTS.has(rawVerdict)
    ? (rawVerdict as VerdictResult['executable_verdict'])
    : 'IGNORE_FUD';

  return {
    drama_index: Math.min(100, Math.max(0, Number(parsed.drama_index) || 0)),
    dominant_branch: String(parsed.dominant_branch || 'unknown'),
    branch_probabilities: (parsed.branch_probabilities as Record<string, number>) || {},
    evidence_chain: Array.isArray(parsed.evidence_chain) ? parsed.evidence_chain as string[] : [],
    executable_verdict,
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : undefined,
    served_from_cache: false,
    fallback: false,
  };
}

// ─────────────────────────────────────────────────────────────
// Main Entry Point (exported)
// ─────────────────────────────────────────────────────────────

export async function executeFudAnalysis(
  coinSymbol: string,
  contractAddress?: string,
  chainId: string = '1'
): Promise<VerdictResult> {
  const FALLBACK: VerdictResult = {
    drama_index: 0,
    dominant_branch: 'pipeline_error',
    branch_probabilities: {},
    evidence_chain: ['Pipeline encountered a fatal error.'],
    executable_verdict: 'IGNORE_FUD',
    confidence: 0,
    served_from_cache: false,
    fallback: true,
  };

  try {
    // ── STEP 0: Granular Dispatcher ───────────────────────────
    console.log("🚦 [STEP 0] Invoking Granular Dispatcher...");
    const dispatcherStrategy = await runGranularDispatcher({
      coinSymbol,
      contractAddress,
      chainId
    });
    console.log("[DISPATCHER THINKING PROCESS]:", JSON.stringify(dispatcherStrategy, null, 2));

    // ── STEP A: Parallel ingestion ────────────────────────────
    console.log("🔍 [STEP A] Gathering data for:", coinSymbol);
    
    const isNative = !contractAddress || contractAddress.trim() === "" || contractAddress.toLowerCase() === "native";

    const orderBookPromise = fetchBybitOrderBook(coinSymbol + 'USDT', dispatcherStrategy);
    const twitterIntelPromise = fetchTwitterIntel(coinSymbol, dispatcherStrategy);
    const telegramIntelPromise = fetchTelegramIntel(coinSymbol, dispatcherStrategy);

    const dexDataPromise = isNative 
      ? Promise.resolve({ liquidityUsd: 0, volume24h: 0, fdv: 0, priceUsd: "0", fallback: true })
      : fetchDexScreenerData(contractAddress!, dispatcherStrategy);

    const securityGoPlusPromise = isNative
      ? Promise.resolve({ isHoneypot: false, isMintable: false, isOpenSource: false, ownerAddress: "", fallback: true })
      : fetchGoPlusSecurity(chainId, contractAddress!, dispatcherStrategy);

    const securityRugCheckPromise = isNative
      ? Promise.resolve({ score: 0, risks: [], isRug: false, fallback: true })
      : fetchRugCheckScore(contractAddress!, dispatcherStrategy);

    // DefiLlama & CoinGecko dispatches
    const defillamaPromise = fetchDefiLlamaProtocols(coinSymbol, dispatcherStrategy);
    const coingeckoMarketsPromise = fetchCoinGeckoMarkets(coinSymbol, dispatcherStrategy);
    const coingeckoMacroPromise = fetchCoinGeckoMacro(coinSymbol, dispatcherStrategy);

    const [
      orderBook, 
      dexData, 
      securityGoPlus, 
      securityRugCheck, 
      twitterIntel, 
      telegramIntel,
      defillamaProtocols,
      coingeckoMarkets,
      coingeckoMacro
    ] = await Promise.all([
      orderBookPromise,
      dexDataPromise,
      securityGoPlusPromise,
      securityRugCheckPromise,
      twitterIntelPromise,
      telegramIntelPromise,
      defillamaPromise,
      coingeckoMarketsPromise,
      coingeckoMacroPromise
    ]);

    console.log('[Pipeline] Step A complete: all ingestion data gathered.');

    // ── STEP B: Lightweight noise filter ─────────────────────
    const socialRaw = `Twitter:\n${twitterIntel.text}\n\nTelegram:\n${telegramIntel.text}`;
    const fudClaimsRaw = await runLightweightEngine(
      LIGHTWEIGHT_SYSTEM_PROMPT,
      `Extract FUD claims from the following social data:\n\n${socialRaw}`
    );

    let fudClaims: string[] = [];
    const parsedClaims = safeParseJSON(fudClaimsRaw);
    if (Array.isArray(parsedClaims)) {
      fudClaims = parsedClaims as string[];
    } else if (typeof fudClaimsRaw === 'string' && fudClaimsRaw.trim().startsWith('[')) {
      try {
        fudClaims = JSON.parse(fudClaimsRaw);
      } catch {
        fudClaims = [fudClaimsRaw]; // Treat as single claim if all else fails
      }
    }

    console.log("🧠 [STEP B] Noise Filter (GPT-OSS) output array length:", fudClaims.length);

    // ── STEP C + D: MCTS + ReAct ──────────────────────────────
    const context: PipelineContext = {
      coinSymbol,
      contractAddress,
      chainId,
      orderBook,
      dexData,
      securityGoPlus,
      securityRugCheck,
      twitterIntel,
      telegramIntel,
      coingeckoMarkets,
      coingeckoMacro,
      defillamaProtocols,
      fudClaims,
    };

    const verdict = await evaluateMCTS(context, 0);
    console.log(`[Pipeline] Analysis complete. Verdict: ${verdict.executable_verdict}, Drama Index: ${verdict.drama_index}`);

    return verdict;
  } catch (error) {
    console.error('[Pipeline] executeFudAnalysis threw a fatal error:', error);
    return FALLBACK;
  }
}
