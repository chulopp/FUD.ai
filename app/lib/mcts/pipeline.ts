import {
  fetchBybitOrderBook,
  fetchBybitPerpetuals,
  fetchDexScreenerData,
  fetchDefiLlamaProtocols,
  fetchCoinGeckoMarkets,
  fetchCoinGeckoMacro,
} from '../ingestion/market';
import { fetchGoPlusSecurity, fetchRugCheckScore } from '../ingestion/security';
import { fetchTwitterIntel } from '../ingestion/rapidapi_twitter';
import { fetchTelegramIntel } from '../ingestion/telegram';
import { filterSpamPosts } from '../ingestion/spam_filter';
import { runLightweightEngine, runHeavyweightEngine } from '../llm/engines';
import { runGranularDispatcher } from './dispatcher';
import { PipelineStepLogger } from './step_logger';
import { buildIngestionKey, getCachedIngestion, setCachedIngestion } from '../redis/ingestion-cache';
import type {
  IngestionResult,
  IngestionStatus,
  DexScreenerData,
  GoPlusData,
  RugCheckData,
  BybitOrderBookData,
  BybitTickerData,
  CoinGeckoMarketsData,
  CoinGeckoMacroData,
  DefiLlamaData,
  SocialIntelData,
} from '../ingestion/types';
import { computeCoordinationSignals, type CoordinationSignals } from '../ingestion/sybil_detector';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type PipelineStatus = 'ok' | 'degraded';

export interface VerdictResult {
  status: PipelineStatus;
  drama_index: number;
  /** Volume/intensity of social discussion (0-100) */
  chatter_level: number;
  /** Validated threat level from on-chain evidence (0-100) */
  risk_score: number;
  /** drama_index = round(0.4 * chatter_level + 0.6 * risk_score) */
  dominant_branch: string;
  branch_probabilities?: Record<string, number>;
  evidence_chain: string[];
  executable_verdict:
    | 'LIQUIDATE_LONGS'
    | 'HOLD'
    | 'ACCUMULATE'
    | 'IGNORE_FUD'
    | 'INSUFFICIENT_DATA';
  /** null when status === 'degraded' — clients must treat null as unusable */
  confidence: number | null;
  served_from_cache: boolean;
  fallback?: boolean;
  reason?: string;
  step_summary?: ReturnType<PipelineStepLogger['getSummary']>;
  coordination_signals?: CoordinationSignals;
}

interface PipelineContext {
  coinSymbol: string;
  contractAddress?: string;
  chainId: string;
  orderBook: IngestionResult<BybitOrderBookData>;
  perpData: IngestionResult<BybitTickerData>;
  dexData: IngestionResult<DexScreenerData>;
  securityGoPlus: IngestionResult<GoPlusData>;
  securityRugCheck: IngestionResult<RugCheckData>;
  twitterIntel: IngestionResult<SocialIntelData>;
  telegramIntel: IngestionResult<SocialIntelData>;
  coingeckoMarkets: IngestionResult<CoinGeckoMarketsData>;
  coingeckoMacro: IngestionResult<CoinGeckoMacroData>;
  defillamaProtocols: IngestionResult<DefiLlamaData>;
  fudClaims: string[];
  // Source status map for grounding check
  sourceStatuses: Record<string, IngestionStatus>;
  coordinationSignals: CoordinationSignals;
}

// ─────────────────────────────────────────────────────────────
// Degraded verdict (P0-A) — returned when heavyweight engine fails
// permanently. Explicitly signals unusability to bot clients.
// ─────────────────────────────────────────────────────────────

function makeDegradedVerdict(reason: string, logger?: PipelineStepLogger): VerdictResult {
  return {
    status: 'degraded',
    drama_index: 0,
    chatter_level: 0,
    risk_score: 0,
    dominant_branch: 'engine_failure',
    branch_probabilities: {},
    evidence_chain: [
      'Heavyweight reasoning engine permanently unavailable — no analysis performed.',
      `Reason: ${reason}`,
    ],
    executable_verdict: 'INSUFFICIENT_DATA',
    confidence: null,
    served_from_cache: false,
    fallback: true,
    reason: 'heavyweight_engine_unavailable',
    step_summary: logger?.getSummary(),
    coordination_signals: {
      unique_author_ratio: 1.0,
      duplicate_text_cluster_size: 0,
      cross_platform_burst_window_minutes: 0,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// System Prompts
// ─────────────────────────────────────────────────────────────

const LIGHTWEIGHT_SYSTEM_PROMPT = `You are a crypto data extractor. Read the social chatter and extract specific FUD claims. Output strictly as a JSON array of strings. Drop spam and irrelevant memes. Example output: ["claim 1", "claim 2"]`;

const HEAVYWEIGHT_SYSTEM_PROMPT = `You are an advanced MCTS evaluator for crypto FUD analysis. Your task is multi-step epistemic reasoning.

ANTI-HALLUCINATION RULES — MANDATORY:
1. Each data source in the input has a "status" field. Possible values: "ok", "empty", "error", "not_called".
2. If a source's status is NOT "ok", you MUST NOT make any claims based on that source's data.
3. For any claim in your evidence_chain, you MUST be able to cite a source with status="ok".
4. If a source returned status="error" or "not_called", explicitly state "data unavailable" for any attribute from that source.
5. NEVER assume a token is safe, honeypot-free, or risk-free just because security data was not fetched.

RUGCHECK CONTEXT:
- The "rugged" flag from RugCheck does NOT necessarily mean the token is currently rugged.
- For tokens that migrated from a bonding-curve/launchpad to a DEX within the last 7 days:
  If current DexScreener liquidity is healthy (>$50,000 USD), significantly DOWNWEIGHT the "rugged" flag.
  Cross-reference: actual liquidity + pairCreatedAt age + trading activity before citing "rugged" as evidence.

OUTPUT SCHEMA — You MUST return a valid JSON object. No markdown fences.

OPTION 1 (Need more data): {"action": "FETCH_MORE", "target": "describe missing data"}

OPTION 2 (Final Verdict): {
  "chatter_level": <integer 0-100, volume/intensity of social chatter>,
  "risk_score": <integer 0-100, validated threat level from on-chain evidence — only cite sources with status=ok>,
  "dominant_branch": "<branch_name>",
  "branch_probabilities": {"<branch>": <0-1>},
  "evidence_chain": ["[SOURCE_NAME] claim text... (Prefix every claim in this array with the matching source name in brackets, e.g. '[BYBIT] Bybit order book shows...' or '[COINGECKO] CoinGecko price is...'. The source name must be one of: BYBIT, COINGECKO, DEXSCREENER, GOPLUS, RUGCHECK, TWITTER, TELEGRAM, DEFILLAMA)"],
  "executable_verdict": "<LIQUIDATE_LONGS|HOLD|ACCUMULATE|IGNORE_FUD>",
  "confidence": <0-1>
}`;

const HYPOTHESIS_SYSTEM_PROMPT = `You are the Hypothesis Generator in an MCTS reasoning pipeline for crypto FUD analysis.

Given the market data, security data, and social claims, generate 3-5 distinct hypotheses (branches) that explain the situation.
Each hypothesis should be plausible given the available evidence.

COORDINATION & SYBIL DETECTION RULES:
1. Utilize the pre-computed coordination metrics under "COORDINATION & SYBIL SIGNALS".
2. If unique_author_ratio is < 0.3 or duplicate_text_cluster_size is >= 5, you MUST explicitly generate a hypothesis around "Coordinated Bot Manipulation" or "Sybil Attack".
3. Reference these exact metrics in the hypothesis description and reasoning.

ANTI-HALLUCINATION: Only reference data sources with status="ok". If a source is "error" or "not_called", DO NOT cite it.

Output a JSON object:
{
  "hypotheses": [
    {"id": "H1", "name": "<branch name>", "description": "<1-2 sentences>", "initial_probability": <0-1>},
    ...
  ],
  "reasoning": "<brief explanation of why these hypotheses were chosen>"
}`;

const ROLLOUT_SYSTEM_PROMPT = (hypothesisName: string) => `You are the Rollout Simulator for hypothesis: "${hypothesisName}".

Given this specific hypothesis and all available evidence, simulate what would happen over the next 1-24 hours if this hypothesis is correct.
Consider: price action, community response, on-chain activity, exchange behavior.

ANTI-HALLUCINATION: Only reference data sources with status="ok".

Output a JSON object:
{
  "hypothesis": "${hypothesisName}",
  "projected_outcome": "<description>",
  "supporting_evidence": ["<evidence item citing ok source>"],
  "contradicting_evidence": ["<evidence item>"],
  "probability_adjustment": <-0.3 to +0.3, how much to adjust initial probability>,
  "confidence": <0-1>
}`;

const CROSS_VALIDATOR_SYSTEM_PROMPT = `You are the Cross-Validator in an MCTS pipeline. You receive rollout results from multiple hypotheses and must validate which ones are internally consistent and supported by multiple independent data sources.

ANTI-HALLUCINATION: Flag any rollout that cites sources with status != "ok" as INVALID. Remove such evidence from consideration.

Output a JSON object:
{
  "validated_hypotheses": [
    {"id": "<H1>", "name": "<name>", "adjusted_probability": <0-1>, "validation_notes": "<notes>"},
    ...
  ],
  "dominant_hypothesis": "<Hx>",
  "cross_validation_summary": "<findings>"
}`;

const REFLEXION_CRITIC_SYSTEM_PROMPT = `You are the Reflexion Critic — the final sanity check before a verdict is issued.

Review all hypotheses, rollouts, and the cross-validator's output. Apply critical scrutiny:
1. Are any extreme verdicts (LIQUIDATE_LONGS) supported by at least 2 independent data categories (security, liquidity, social)?
2. Are there any contradictions between social claims and on-chain data?
3. Is the confidence level proportional to the quality and quantity of available data?
4. If major data sources are unavailable (status=error/not_called), confidence MUST be lower.
5. If unique_author_ratio is < 0.3 or duplicate_text_cluster_size is >= 5, you MUST explicitly cite these exact metrics in the evidence_chain as proof of coordinated bot manipulation, prefixing them with '[SYBIL]'.
   Example: "[SYBIL] Coordinated bot manipulation detected: unique_author_ratio is 0.15 and duplicate_text_cluster_size is 12."

Output a JSON object:
{
  "final_chatter_level": <integer 0-100>,
  "final_risk_score": <integer 0-100>,
  "dominant_branch": "<name>",
  "branch_probabilities": {"<branch>": <0-1>},
  "evidence_chain": ["[SOURCE_NAME] Grounded claim text... (You MUST prefix every claim in this array with the matching source name in brackets, e.g. '[BYBIT] Bybit order book shows...' or '[COINGECKO] CoinGecko price is...'. The source name must be one of: BYBIT, COINGECKO, DEXSCREENER, GOPLUS, RUGCHECK, TWITTER, TELEGRAM, DEFILLAMA, SYBIL)"],
  "executable_verdict": "<LIQUIDATE_LONGS|HOLD|ACCUMULATE|IGNORE_FUD>",
  "confidence": <0-1>,
  "critic_notes": "<explanation of key decisions>"
}`;

const CONCLUSION_FORCED_SUFFIX = `\n\nCONCLUSION FORCED: You MUST now output the Final Verdict JSON (OPTION 2) immediately. Do not output FETCH_MORE again.`;

// ─────────────────────────────────────────────────────────────
// Safe JSON parser
// ─────────────────────────────────────────────────────────────

function safeParseJSON(raw: string): Record<string, unknown> | null {
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    return JSON.parse(cleaned);
  } catch {
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
// Build data prompt section from IngestionResult
// ─────────────────────────────────────────────────────────────

function formatIngestionResult<T>(label: string, result: IngestionResult<T>): string {
  if (result.status === 'not_called') {
    return `=== ${label} ===\nStatus: not_called (source intentionally skipped — do NOT make claims about this data)\n`;
  }
  if (result.status === 'error') {
    return `=== ${label} ===\nStatus: error — ${result.error_detail || 'unknown error'}\nDATA UNAVAILABLE — do NOT assume safe/zero/normal values from this source\n`;
  }
  if (result.status === 'empty') {
    return `=== ${label} ===\nStatus: empty (no data returned for this token)\n`;
  }
  // status === 'ok'
  return `=== ${label} ===\nStatus: ok\n${JSON.stringify(result.data, null, 2)}\n`;
}

// ─────────────────────────────────────────────────────────────
// Build full context prompt for LLM steps
// ─────────────────────────────────────────────────────────────

function buildContextPrompt(context: PipelineContext): string {
  const parts: string[] = [];
  parts.push(`COIN: ${context.coinSymbol}`);
  parts.push(`CONTRACT: ${context.contractAddress || 'none'} (Chain ID: ${context.chainId})\n`);

  parts.push(formatIngestionResult('BYBIT ORDER BOOK (Spot)', context.orderBook));
  parts.push(formatIngestionResult('BYBIT PERPETUALS (Perp/Funding)', context.perpData));
  parts.push(formatIngestionResult('DEXSCREENER (DEX Liquidity & Pairs)', context.dexData));
  parts.push(formatIngestionResult('GOPLUS SECURITY (EVM Smart Contract)', context.securityGoPlus));
  parts.push(formatIngestionResult('RUGCHECK (Solana Risk Score)', context.securityRugCheck));
  parts.push(formatIngestionResult('COINGECKO MARKETS (Price & Cap)', context.coingeckoMarkets));
  parts.push(formatIngestionResult('COINGECKO MACRO (Community & Dev Activity)', context.coingeckoMacro));
  parts.push(formatIngestionResult('DEFILLAMA (TVL)', context.defillamaProtocols));

  parts.push(`=== FUD CLAIMS (Extracted from Social Intel, pre-filtered for spam) ===`);
  if (context.fudClaims.length > 0) {
    parts.push(context.fudClaims.map((c, i) => `${i + 1}. ${c}`).join('\n'));
  } else {
    parts.push('No specific FUD claims detected in social data.');
  }

  parts.push(`\n=== COORDINATION & SYBIL SIGNALS ===`);
  parts.push(JSON.stringify(context.coordinationSignals, null, 2));

  return parts.join('\n');
}

// ─────────────────────────────────────────────────────────────
// Evidence Chain Grounding Check (P2-C)
// Drops or tags claims that reference unavailable sources.
// ─────────────────────────────────────────────────────────────

const SOURCE_KEYWORDS: Record<string, string[]> = {
  goplus: ['honeypot', 'mintable', 'open source', 'hidden owner', 'buy tax', 'sell tax', 'goplus'],
  rugcheck: ['rugcheck', 'rug score', 'rugged token', 'is rug'],
  dexscreener: ['dexscreener', 'dex pool', 'dex pair', 'dex liquidity'],
  bybit: ['bybit', 'perpetual funding', 'funding rate', 'open interest', 'order book depth'],
  twitter: ['twitter', 'tweet', 'x.com', 'social sentiment'],
  telegram: ['telegram', 'tg channel'],
  coingecko: ['coingecko', 'gecko market', 'cg price'],
  defillama: ['defillama', 'tvl protocol', 'total value locked'],
  sybil: ['sybil', 'bot manipulation', 'unique_author_ratio', 'duplicate_text_cluster_size', 'coordination_signals'],
};

function groundEvidenceChain(
  evidence: string[],
  sourceStatuses: Record<string, IngestionStatus>
): string[] {
  const grounded: string[] = [];

  for (const claim of evidence) {
    const claimLower = claim.toLowerCase();
    let shouldDrop = false;

    // 1. Try to parse bracket prefix e.g., "[BYBIT]" or "[BYBIT]:"
    const prefixMatch = claim.match(/^\[([A-Z_]+)\]\s*(?::)?\s*/i);
    if (prefixMatch) {
      const sourceName = prefixMatch[1].toLowerCase();
      
      // Normalize common names
      let mappedSource = sourceName;
      if (sourceName === 'twitter' || sourceName === 'x') mappedSource = 'twitter';
      else if (sourceName === 'telegram') mappedSource = 'telegram';
      else if (sourceName === 'bybit') mappedSource = 'bybit';
      else if (sourceName === 'coingecko') mappedSource = 'coingecko';
      else if (sourceName === 'dexscreener') mappedSource = 'dexscreener';
      else if (sourceName === 'goplus') mappedSource = 'goplus';
      else if (sourceName === 'rugcheck') mappedSource = 'rugcheck';
      else if (sourceName === 'defillama') mappedSource = 'defillama';
      else if (sourceName === 'sybil') mappedSource = 'sybil';

      if (sourceStatuses[mappedSource] !== undefined) {
        if (sourceStatuses[mappedSource] !== 'ok') {
          console.warn(
            `[Grounding] Dropping unverified claim with prefix [${mappedSource.toUpperCase()}] (status: ${sourceStatuses[mappedSource]}): "${claim.substring(0, 80)}..."`
          );
          shouldDrop = true;
        }
        if (shouldDrop || sourceStatuses[mappedSource] === 'ok') {
          // If we matched the prefix and either dropped or kept it, we are done with this claim.
          if (!shouldDrop) {
            grounded.push(claim);
          }
          continue;
        }
      }
    }

    // 2. Fallback: Keyword-based matching if no valid bracket prefix was parsed
    for (const [source, keywords] of Object.entries(SOURCE_KEYWORDS)) {
      const mentionsSource = keywords.some(kw => claimLower.includes(kw));
      if (mentionsSource && sourceStatuses[source] !== 'ok') {
        console.warn(
          `[Grounding] Dropping unverified claim referencing "${source}" via fallback keyword (status: ${sourceStatuses[source]}): "${claim.substring(0, 80)}..."`
        );
        shouldDrop = true;
        break;
      }
    }

    if (!shouldDrop) {
      grounded.push(claim);
    }
  }

  return grounded;
}

// ─────────────────────────────────────────────────────────────
// Extreme Verdict Gate (P3-A)
// LIQUIDATE_LONGS at high confidence requires ≥2 independent
// data categories confirmed (security, liquidity, social).
// ─────────────────────────────────────────────────────────────

function applyExtremeVerdictGate(
  verdict: Omit<VerdictResult, 'status' | 'served_from_cache' | 'step_summary'>,
  sourceStatuses: Record<string, IngestionStatus>
): typeof verdict {
  if (verdict.executable_verdict === 'LIQUIDATE_LONGS' && (verdict.confidence ?? 0) > 0.85) {
    const categories = {
      security: ['goplus', 'rugcheck'].some(s => sourceStatuses[s] === 'ok'),
      liquidity: ['dexscreener', 'bybit'].some(s => sourceStatuses[s] === 'ok'),
      social: ['twitter', 'telegram'].some(s => sourceStatuses[s] === 'ok'),
    };
    const confirmedCount = Object.values(categories).filter(Boolean).length;

    if (confirmedCount < 2) {
      console.warn(
        `[ExtremeVerdictGate] LIQUIDATE_LONGS blocked: only ${confirmedCount}/3 independent data categories confirmed. ` +
        `Security=${categories.security}, Liquidity=${categories.liquidity}, Social=${categories.social}. ` +
        `Downgrading to HOLD.`
      );
      return {
        ...verdict,
        executable_verdict: 'HOLD',
        confidence: Math.min(verdict.confidence ?? 0, 0.6),
        evidence_chain: [
          ...verdict.evidence_chain,
          `[GATE] Extreme verdict downgraded from LIQUIDATE_LONGS: insufficient independent evidence ` +
          `(${confirmedCount}/3 categories available: security=${categories.security}, liquidity=${categories.liquidity}, social=${categories.social}).`,
        ],
      };
    }
  }
  return verdict;
}

// ─────────────────────────────────────────────────────────────
// ReAct: Dynamic Fetch Handler
// ─────────────────────────────────────────────────────────────

async function handleDynamicFetch(target: string, context: PipelineContext): Promise<string> {
  console.log('🔄 [ReAct] Dynamic Fetch triggered for target:', target);
  const t = target.toLowerCase();
  try {
    if (t.includes('perp') || t.includes('open interest') || t.includes('funding')) {
      const perpResult = await fetchBybitPerpetuals(context.coinSymbol + 'USDT');
      if (perpResult.status === 'ok' && perpResult.data) {
        return `Perpetuals data for ${context.coinSymbol}: Open Interest = ${perpResult.data.openInterest}, Funding Rate = ${perpResult.data.fundingRate}`;
      }
      return `Perpetuals data unavailable (status: ${perpResult.status})`;
    }
    if (t.includes('liquidity') || t.includes('dex') || t.includes('volume')) {
      if (!context.contractAddress || context.contractAddress.toLowerCase() === 'native') {
        return `DEX data: Not available for native tokens without a contract address`;
      }
      const dexResult = await fetchDexScreenerData(context.contractAddress, context.chainId);
      if (dexResult.status === 'ok' && dexResult.data) {
        return `DEX data: Liquidity = $${dexResult.data.liquidityUsd}, 24h Volume = $${dexResult.data.volume24h}, Price = $${dexResult.data.priceUsd}`;
      }
      return `DEX data unavailable (status: ${dexResult.status})`;
    }
    return `DATA_UNAVAILABLE: ${target}. Proceed with existing context.`;
  } catch (error) {
    console.error('[Pipeline] handleDynamicFetch error:', error);
    return `DATA_UNAVAILABLE: Fetch failed for "${target}". Proceed with existing context.`;
  }
}

// ─────────────────────────────────────────────────────────────
// Multi-Step MCTS Evaluation (P2-B: ≥5 LLM calls per request)
//
// Step 1: Hypothesis Generator
// Step 2: Rollout Simulator (per hypothesis, min 3 hypotheses = min 3 calls)
// Step 3: Cross-Validator
// Step 4: Reflexion Critic
// [Optional] Step 5: ReAct FETCH_MORE if needed (adds 1-2 more calls)
//
// Total minimum: 1 (hyp) + 3 (rollouts) + 1 (cross) + 1 (critic) = 6 calls ✓
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// Adaptive Depth Check
// Returns true if any single hypothesis already dominates at > threshold
// after probability_adjustment is applied. If true, we skip remaining rollouts.
// ─────────────────────────────────────────────────────────────

function checkAdaptiveDepth(
  hypotheses: Array<{ id: string; name: string; initial_probability: number }>,
  rolloutContents: string[],
  threshold: number
): boolean {
  let dominates = false;
  rolloutContents.forEach((content, i) => {
    const parsed = safeParseJSON(content);
    if (!parsed) return;
    const adj = typeof parsed.probability_adjustment === 'number' ? parsed.probability_adjustment : 0;
    const baseProbability = hypotheses[i]?.initial_probability ?? 0;
    const adjusted = Math.min(1, Math.max(0, baseProbability + adj));
    if (adjusted > threshold) {
      console.log(
        `⚡ [MCTS Adaptive] Early exit: hypothesis "${hypotheses[i]?.name}" dominates at ${(adjusted * 100).toFixed(1)}% (threshold: ${threshold * 100}%). Skipping remaining rollouts.`
      );
      dominates = true;
    }
  });
  return dominates;
}

// ─────────────────────────────────────────────────────────────
// Single rollout executor — used by Promise.all
// ─────────────────────────────────────────────────────────────

async function executeRollout(
  hyp: { id: string; name: string; description: string; initial_probability: number },
  contextPrompt: string,
  logger: PipelineStepLogger
): Promise<string> {
  console.log(`🎲 [MCTS Step 2] Rollout for "${hyp.name}"...`);
  const rolloutStart = Date.now();
  const rolloutPrompt = `CONTEXT:\n${contextPrompt}\n\nHYPOTHESIS TO EVALUATE:\nID: ${hyp.id}\nName: ${hyp.name}\nDescription: ${hyp.description}\nInitial Probability: ${hyp.initial_probability}`;

  let rolloutResult: HeavyweightResult;
  try {
    rolloutResult = await runHeavyweightEngine(ROLLOUT_SYSTEM_PROMPT(hyp.name), rolloutPrompt);
  } catch (err: any) {
    console.warn(`[MCTS] Rollout for "${hyp.name}" failed: ${err.message}`);
    return JSON.stringify({ hypothesis: hyp.name, error: 'rollout_failed' });
  }
  logger.log({
    step_name: `rollout_${hyp.id.toLowerCase()}`,
    model: 'deepseek-chat',
    input_tokens: rolloutResult.usage.prompt_tokens,
    output_tokens: rolloutResult.usage.completion_tokens,
    cached_tokens: rolloutResult.usage.cached_tokens,
    execution_time_ms: Date.now() - rolloutStart,
    timestamp: new Date().toISOString(),
  });
  return rolloutResult.content;
}

// ─────────────────────────────────────────────────────────────
// Multi-Step MCTS Evaluation — Parallelized
//
// Step 1: Hypothesis Generator
// Step 2: Rollout Simulator — first 3 hypotheses run in parallel via
//         Promise.all. If any branch dominates >80%, remaining rollouts
//         are skipped (Adaptive Depth). Otherwise remaining run in parallel.
// Step 3: Cross-Validator (decoupled — receives full rollout set)
// Step 4: Reflexion Critic (sequential after Cross-Validator — requires
//         its output as input; structural decoupling via helper functions)
// [Optional] Step 5: ReAct FETCH_MORE
//
// Minimum calls: 1 (hyp) + 3 (parallel rollouts) + 1 (cross) + 1 (critic) = 6
// With early exit: 1 + 3 + 1 + 1 = 6 (same min, but ~2x faster wall-clock)
// ─────────────────────────────────────────────────────────────

async function runMultiStepMCTS(
  context: PipelineContext,
  logger: PipelineStepLogger
): Promise<VerdictResult> {
  const mctsStart = Date.now();
  const contextPrompt = buildContextPrompt(context);

  // ── Step 1: Hypothesis Generator ─────────────────────────
  console.log('🌳 [MCTS Step 1] Hypothesis Generator...');
  const step1Start = Date.now();
  let hypothesesResult: HeavyweightResult;
  try {
    hypothesesResult = await runHeavyweightEngine(HYPOTHESIS_SYSTEM_PROMPT, contextPrompt);
  } catch (err: any) {
    throw new Error(`heavyweight_engine_unavailable: ${err.message}`);
  }
  logger.log({
    step_name: 'hypothesis_generator',
    model: 'deepseek-chat',
    input_tokens: hypothesesResult.usage.prompt_tokens,
    output_tokens: hypothesesResult.usage.completion_tokens,
    cached_tokens: hypothesesResult.usage.cached_tokens,
    execution_time_ms: Date.now() - step1Start,
    timestamp: new Date().toISOString(),
  });

  const hypothesesParsed = safeParseJSON(hypothesesResult.content);
  const hypotheses: Array<{ id: string; name: string; description: string; initial_probability: number }> =
    (hypothesesParsed?.hypotheses as any) || [
      { id: 'H1', name: 'FUD False', description: 'Claims are exaggerated or fabricated.', initial_probability: 0.5 },
      { id: 'H2', name: 'FUD True', description: 'Claims reflect real risks.', initial_probability: 0.3 },
      { id: 'H3', name: 'Manipulation', description: 'Coordinated market manipulation.', initial_probability: 0.2 },
    ];

  console.log(`🌳 [MCTS Step 1] Generated ${hypotheses.length} hypotheses:`, hypotheses.map(h => h.name));

  // ── Step 2: Parallel Rollout Simulator ───────────────────
  // Phase A: Run first min(3, total) rollouts simultaneously
  const PARALLEL_BATCH_SIZE = 3;
  const ADAPTIVE_DEPTH_THRESHOLD = 0.80;

  const firstBatch = hypotheses.slice(0, PARALLEL_BATCH_SIZE);
  console.log(`🎲 [MCTS Step 2] Running first ${firstBatch.length} rollouts in parallel...`);
  const firstBatchStart = Date.now();

  const firstRolloutContents = await Promise.all(
    firstBatch.map(hyp => executeRollout(hyp, contextPrompt, logger))
  );

  console.log(`🎲 [MCTS Step 2] First ${firstBatch.length} rollouts completed in ${Date.now() - firstBatchStart}ms`);

  let rolloutResults: string[] = [...firstRolloutContents];

  // Phase B: Adaptive Depth — check if any hypothesis already dominates
  const earlyExit = hypotheses.length > PARALLEL_BATCH_SIZE
    ? checkAdaptiveDepth(firstBatch, firstRolloutContents, ADAPTIVE_DEPTH_THRESHOLD)
    : false;

  if (!earlyExit && hypotheses.length > PARALLEL_BATCH_SIZE) {
    const remainingBatch = hypotheses.slice(PARALLEL_BATCH_SIZE);
    console.log(`🎲 [MCTS Step 2] Signal ambiguous — running ${remainingBatch.length} additional rollouts in parallel...`);
    const remainingStart = Date.now();
    const remainingContents = await Promise.all(
      remainingBatch.map(hyp => executeRollout(hyp, contextPrompt, logger))
    );
    console.log(`🎲 [MCTS Step 2] Additional rollouts done in ${Date.now() - remainingStart}ms`);
    rolloutResults = [...rolloutResults, ...remainingContents];
  } else if (earlyExit) {
    console.log('⚡ [MCTS Step 2] Adaptive early exit applied — using first 3 rollouts only.');
  }

  // ── Step 3: Cross-Validator (decoupled input builder) ────
  console.log('🔬 [MCTS Step 3] Cross-Validator...');
  const crossStart = Date.now();

  // Decoupled: build cross-validator prompt from complete rollout set
  const buildCrossPrompt = () =>
    `ORIGINAL CONTEXT:\n${contextPrompt}\n\nHYPOTHESES:\n${JSON.stringify(hypotheses, null, 2)}\n\nROLLOUT RESULTS:\n${rolloutResults.join('\n\n---\n\n')}`;

  let crossResult: HeavyweightResult;
  try {
    crossResult = await runHeavyweightEngine(CROSS_VALIDATOR_SYSTEM_PROMPT, buildCrossPrompt());
  } catch (err: any) {
    throw new Error(`heavyweight_engine_unavailable: ${err.message}`);
  }
  logger.log({
    step_name: 'cross_validator',
    model: 'deepseek-chat',
    input_tokens: crossResult.usage.prompt_tokens,
    output_tokens: crossResult.usage.completion_tokens,
    cached_tokens: crossResult.usage.cached_tokens,
    execution_time_ms: Date.now() - crossStart,
    timestamp: new Date().toISOString(),
  });

  // ── Step 4: Reflexion Critic (decoupled input builder) ───
  // Structurally decoupled: receives cross-validator output as explicit param
  console.log('🪞 [MCTS Step 4] Reflexion Critic...');
  const reflexionStart = Date.now();

  const buildReflexionPrompt = (crossValidatorOutput: string) =>
    `ORIGINAL CONTEXT:\n${contextPrompt}\n\nHYPOTHESES:\n${JSON.stringify(hypotheses, null, 2)}\n\nROLLOUT RESULTS:\n${rolloutResults.join('\n\n---\n\n')}\n\nCROSS-VALIDATOR OUTPUT:\n${crossValidatorOutput}`;

  let reflexionResult: HeavyweightResult;
  try {
    reflexionResult = await runHeavyweightEngine(
      REFLEXION_CRITIC_SYSTEM_PROMPT,
      buildReflexionPrompt(crossResult.content)
    );
  } catch (err: any) {
    throw new Error(`heavyweight_engine_unavailable: ${err.message}`);
  }
  logger.log({
    step_name: 'reflexion_critic',
    model: 'deepseek-chat',
    input_tokens: reflexionResult.usage.prompt_tokens,
    output_tokens: reflexionResult.usage.completion_tokens,
    cached_tokens: reflexionResult.usage.cached_tokens,
    execution_time_ms: Date.now() - reflexionStart,
    timestamp: new Date().toISOString(),
  });

  const parsed = safeParseJSON(reflexionResult.content);
  if (!parsed) {
    console.error('[MCTS] Reflexion Critic output could not be parsed:', reflexionResult.content);
    throw new Error('heavyweight_engine_unavailable: reflexion_critic_parse_failed');
  }

  // ── Check for FETCH_MORE in any step ────────────────────
  if ((parsed as any).action === 'FETCH_MORE' && context.contractAddress) {
    const target = String((parsed as any).target || 'dex liquidity');
    console.log(`[MCTS] FETCH_MORE requested by reflexion critic: "${target}"`);
    const additionalData = await handleDynamicFetch(target, context);
    const updatedContext: PipelineContext = {
      ...context,
      fudClaims: [...context.fudClaims, `[DYNAMIC FETCH RESULT] ${additionalData}`],
    };
    console.log('🎯 [MCTS Step 5] Final Synthesis after FETCH_MORE...');
    const synthStart = Date.now();
    let synthResult: HeavyweightResult;
    try {
      synthResult = await runHeavyweightEngine(
        REFLEXION_CRITIC_SYSTEM_PROMPT + CONCLUSION_FORCED_SUFFIX,
        buildContextPrompt(updatedContext) + `\n\nADDITIONAL DATA: ${additionalData}`
      );
    } catch (err: any) {
      throw new Error(`heavyweight_engine_unavailable: ${err.message}`);
    }
    logger.log({
      step_name: 'final_synthesis',
      model: 'deepseek-chat',
      input_tokens: synthResult.usage.prompt_tokens,
      output_tokens: synthResult.usage.completion_tokens,
      cached_tokens: synthResult.usage.cached_tokens,
      execution_time_ms: Date.now() - synthStart,
      timestamp: new Date().toISOString(),
    });
    const synthParsed = safeParseJSON(synthResult.content);
    if (synthParsed) return buildVerdict(synthParsed, context.sourceStatuses, logger, context.coordinationSignals);
  }

  const totalMctsMs = Date.now() - mctsStart;
  console.log(`⚙️ [MCTS] Full pipeline completed in ${totalMctsMs}ms (${rolloutResults.length} rollouts, earlyExit=${earlyExit})`);

  return buildVerdict(parsed, context.sourceStatuses, logger, context.coordinationSignals);
}

// Re-export type for use in logger
type HeavyweightResult = Awaited<ReturnType<typeof runHeavyweightEngine>>;

// ─────────────────────────────────────────────────────────────
// Verdict builder — normalizes LLM output → VerdictResult
// Applies grounding check + extreme verdict gate.
// ─────────────────────────────────────────────────────────────

const VALID_VERDICTS = new Set([
  'LIQUIDATE_LONGS', 'HOLD', 'ACCUMULATE', 'IGNORE_FUD', 'INSUFFICIENT_DATA'
]);

function buildVerdict(
  parsed: Record<string, unknown>,
  sourceStatuses: Record<string, IngestionStatus>,
  logger: PipelineStepLogger,
  coordinationSignals: CoordinationSignals
): VerdictResult {
  const rawVerdict = String(parsed.executable_verdict ?? 'IGNORE_FUD').toUpperCase();
  const executable_verdict = VALID_VERDICTS.has(rawVerdict)
    ? (rawVerdict as VerdictResult['executable_verdict'])
    : 'IGNORE_FUD';

  // Support both new (chatter_level/risk_score) and legacy (drama_index) output
  const chatter_level = Math.min(100, Math.max(0, Number(parsed.final_chatter_level ?? parsed.chatter_level ?? 0)));
  const risk_score = Math.min(100, Math.max(0, Number(parsed.final_risk_score ?? parsed.risk_score ?? 0)));
  const drama_index = Math.round(0.4 * chatter_level + 0.6 * risk_score);

  const rawEvidence = Array.isArray(parsed.evidence_chain)
    ? (parsed.evidence_chain as string[])
    : [];

  // Apply grounding check — drop evidence citing unavailable sources
  const groundedEvidence = groundEvidenceChain(rawEvidence, sourceStatuses);

  const partialVerdict = {
    drama_index,
    chatter_level,
    risk_score,
    dominant_branch: String(parsed.dominant_branch || 'unknown'),
    branch_probabilities: (parsed.branch_probabilities as Record<string, number>) || {},
    evidence_chain: groundedEvidence,
    executable_verdict,
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : null,
  };

  // Apply extreme verdict gate
  const gatedVerdict = applyExtremeVerdictGate(partialVerdict, sourceStatuses);

  return {
    status: 'ok',
    ...gatedVerdict,
    served_from_cache: false,
    fallback: false,
    step_summary: logger.getSummary(),
    coordination_signals: coordinationSignals,
  };
}

// ─────────────────────────────────────────────────────────────
// Source status map builder
// ─────────────────────────────────────────────────────────────

interface IngestionBundle {
  orderBook: IngestionResult<BybitOrderBookData>;
  perpData: IngestionResult<BybitTickerData>;
  dexData: IngestionResult<DexScreenerData>;
  securityGoPlus: IngestionResult<GoPlusData>;
  securityRugCheck: IngestionResult<RugCheckData>;
  twitterIntel: IngestionResult<SocialIntelData>;
  telegramIntel: IngestionResult<SocialIntelData>;
  coingeckoMarkets: IngestionResult<CoinGeckoMarketsData>;
  coingeckoMacro: IngestionResult<CoinGeckoMacroData>;
  defillamaProtocols: IngestionResult<DefiLlamaData>;
}

function buildSourceStatuses(bundle: IngestionBundle): Record<string, IngestionStatus> {
  return {
    bybit: bundle.orderBook.status === 'ok' || bundle.perpData.status === 'ok' ? 'ok' : bundle.orderBook.status,
    dexscreener: bundle.dexData.status,
    goplus: bundle.securityGoPlus.status,
    rugcheck: bundle.securityRugCheck.status,
    twitter: bundle.twitterIntel.status,
    telegram: bundle.telegramIntel.status,
    coingecko: bundle.coingeckoMarkets.status === 'ok' ? 'ok' : bundle.coingeckoMacro.status,
    defillama: bundle.defillamaProtocols.status,
    sybil: 'ok',
  };
}


// ─────────────────────────────────────────────────────────────
// Normalized metrics for legacy log output
// ─────────────────────────────────────────────────────────────

function getNormalizedMetrics(
  dexData: IngestionResult<DexScreenerData>,
  coingeckoMarkets: IngestionResult<CoinGeckoMarketsData>,
  orderBook: IngestionResult<BybitOrderBookData>
): { priceUsd: string; volume24h: number; marketCap: number; liquidityUsd: number } {
  const dex = dexData.status === 'ok' ? dexData.data : null;
  const cg = coingeckoMarkets.status === 'ok' ? coingeckoMarkets.data : null;
  const ob = orderBook.status === 'ok' ? orderBook.data : null;

  const priceUsd =
    (dex && parseFloat(dex.priceUsd) > 0) ? dex.priceUsd :
    (cg && cg.current_price > 0) ? String(cg.current_price) :
    (ob && ob.b.length > 0) ? ob.b[0][0] : '0';

  const volume24h = (dex && dex.volume24h > 0) ? dex.volume24h : (cg?.total_volume ?? 0);
  const marketCap = (dex && dex.fdv > 0) ? dex.fdv : (cg?.market_cap ?? 0);
  const liquidityUsd = dex?.liquidityUsd ?? 0;

  return { priceUsd, volume24h, marketCap, liquidityUsd };
}

// ─────────────────────────────────────────────────────────────
// Main Entry Point (exported)
// ─────────────────────────────────────────────────────────────

export async function executeFudAnalysis(
  coinSymbol: string,
  contractAddress?: string,
  chainId: string = '1'
): Promise<VerdictResult> {
  const logger = new PipelineStepLogger();

  // Determine if this is a native/no-contract token
  const isNative = !contractAddress
    || contractAddress.trim() === ''
    || contractAddress.toLowerCase() === 'native';

  const FATAL_FALLBACK: VerdictResult = {
    status: 'degraded',
    drama_index: 0,
    chatter_level: 0,
    risk_score: 0,
    dominant_branch: 'pipeline_error',
    branch_probabilities: {},
    evidence_chain: ['Pipeline encountered a fatal error.'],
    executable_verdict: 'INSUFFICIENT_DATA',
    confidence: null,
    served_from_cache: false,
    fallback: true,
    reason: 'pipeline_fatal_error',
    coordination_signals: {
      unique_author_ratio: 1.0,
      duplicate_text_cluster_size: 0,
      cross_platform_burst_window_minutes: 0,
    },
  };

  try {
    // ── STEP 0: Granular Dispatcher ─────────────────────────
    console.log('🚦 [STEP 0] Invoking Granular Dispatcher...');
    const dispatcherStrategy = await runGranularDispatcher({ coinSymbol, contractAddress, chainId });
    console.log('[DISPATCHER THINKING PROCESS]:', JSON.stringify(dispatcherStrategy, null, 2));

    // ── STEP A: Parallel Ingestion (with Granular Cache) ───
    console.log('🔍 [STEP A] Gathering data for:', coinSymbol);

    // Helper: try cache first, fallback to live fetch, write to cache on ok
    async function withIngestionCache<T>(
      source: string,
      fetcher: () => Promise<{ status: string; data: T | null; error_detail?: string }>
    ): Promise<{ status: any; data: T | null; error_detail?: string }> {
      const cacheKey = buildIngestionKey(source, coinSymbol, contractAddress, chainId);
      const cached = await getCachedIngestion<T>(cacheKey);
      if (cached) {
        console.log(`⚡ [IngestionCache] HIT for ${source} (${coinSymbol}) — skipping live fetch`);
        return { status: 'ok', data: cached };
      }
      const result = await fetcher();
      if (result.status === 'ok' && result.data) {
        await setCachedIngestion(cacheKey, result.data);
      }
      return result;
    }

    // Bybit: always call by symbol — works for native tokens too
    // Bybit is cached (quantitative market data, low volatility over 2 min)
    const orderBookPromise = withIngestionCache('bybit_orderbook', () =>
      fetchBybitOrderBook(coinSymbol + 'USDT', dispatcherStrategy)
        .catch(err => {
          console.warn('⚠️ [Pipeline] fetchBybitOrderBook failed:', err.message);
          return { status: 'error' as const, data: null, error_detail: err.message };
        })
    );

    const perpDataPromise = withIngestionCache('bybit_perp', () =>
      fetchBybitPerpetuals(coinSymbol + 'USDT', dispatcherStrategy)
        .catch(err => {
          console.warn('⚠️ [Pipeline] fetchBybitPerpetuals failed:', err.message);
          return { status: 'error' as const, data: null, error_detail: err.message };
        })
    );

    // Twitter/Telegram: NOT cached (too volatile / real-time sentiment)
    const twitterIntelPromise = fetchTwitterIntel(coinSymbol, dispatcherStrategy)
      .catch(err => {
        console.warn('⚠️ [Pipeline] fetchTwitterIntel failed:', err.message);
        return { status: 'error' as const, data: null, error_detail: err.message };
      });

    const telegramIntelPromise = fetchTelegramIntel(coinSymbol, dispatcherStrategy)
      .catch(err => {
        console.warn('⚠️ [Pipeline] fetchTelegramIntel failed:', err.message);
        return { status: 'error' as const, data: null, error_detail: err.message };
      });

    // DexScreener: NOT cached (real-time price/liquidity data)
    const dexDataPromise = isNative
      ? Promise.resolve({ status: 'not_called' as const, data: null })
      : fetchDexScreenerData(contractAddress!, chainId)
          .catch(err => ({
            status: 'error' as const,
            data: null,
            error_detail: err.message,
          }));

    // GoPlus: EVM only, gated by dispatcher — cached (security data stable over 2 min)
    const securityGoPlusPromise = isNative
      ? Promise.resolve({ status: 'not_called' as const, data: null })
      : withIngestionCache('goplus', () =>
          fetchGoPlusSecurity(chainId, contractAddress!, dispatcherStrategy)
            .catch(err => ({
              status: 'error' as const,
              data: null,
              error_detail: err.message,
            }))
        );

    // RugCheck: Solana only, gated by dispatcher (not cached — low call frequency)
    const securityRugCheckPromise = isNative
      ? Promise.resolve({ status: 'not_called' as const, data: null })
      : fetchRugCheckScore(contractAddress!, dispatcherStrategy)
          .catch(err => ({
            status: 'error' as const,
            data: null,
            error_detail: err.message,
          }));

    // CoinGecko: cached (market data stable over 2 min)
    const defillamaPromise = withIngestionCache('defillama', () =>
      fetchDefiLlamaProtocols(coinSymbol, dispatcherStrategy)
        .catch(err => ({ status: 'error' as const, data: null, error_detail: err.message }))
    );

    const coingeckoMarketsPromise = withIngestionCache('coingecko_markets', () =>
      fetchCoinGeckoMarkets(coinSymbol, dispatcherStrategy)
        .catch(err => ({ status: 'error' as const, data: null, error_detail: err.message }))
    );

    const coingeckoMacroPromise = withIngestionCache('coingecko_macro', () =>
      fetchCoinGeckoMacro(coinSymbol, dispatcherStrategy)
        .catch(err => ({ status: 'error' as const, data: null, error_detail: err.message }))
    );

    const [
      orderBook,
      perpData,
      dexData,
      securityGoPlus,
      securityRugCheck,
      twitterIntel,
      telegramIntel,
      defillamaProtocols,
      coingeckoMarkets,
      coingeckoMacro,
    ] = await Promise.all([
      orderBookPromise,
      perpDataPromise,
      dexDataPromise,
      securityGoPlusPromise,
      securityRugCheckPromise,
      twitterIntelPromise,
      telegramIntelPromise,
      defillamaPromise,
      coingeckoMarketsPromise,
      coingeckoMacroPromise,
    ]);

    console.log('[Pipeline] Step A complete: all ingestion data gathered (with cache).');

    // Legacy normalized metrics log (for test-intelligence.js interceptor)
    const metrics = getNormalizedMetrics(dexData, coingeckoMarkets, orderBook);
    console.log('[NORMALIZED_METRICS_PAYLOAD]:', JSON.stringify(metrics));

    // ── STEP B: Spam filter + Lightweight noise filter ──────
    // Apply spam filter to raw social posts before extracting FUD claims
    const twitterPosts = (twitterIntel.status === 'ok' ? twitterIntel.data?.posts ?? [] : []) as { text: string; [key: string]: unknown }[];
    const telegramPosts = (telegramIntel.status === 'ok' ? telegramIntel.data?.posts ?? [] : []) as { text: string; [key: string]: unknown }[];

    const filteredTwitter = filterSpamPosts(twitterPosts);
    const filteredTelegram = filterSpamPosts(telegramPosts);

    // Compute coordination & Sybil detection signals on combined social posts
    const combinedPosts = [
      ...filteredTwitter.map(p => ({
        text: p.text,
        author_id: (p as any).author_id,
        timestamp: (p as any).timestamp,
        username: (p as any).username,
      })),
      ...filteredTelegram.map(p => ({
        text: p.text,
        author_id: (p as any).author_id,
        timestamp: (p as any).timestamp,
        channel: (p as any).channel,
      }))
    ];
    const coordinationSignals = computeCoordinationSignals(combinedPosts);
    console.log('[Pipeline] Computed Coordination Signals:', JSON.stringify(coordinationSignals));

    const socialRaw = [
      `Twitter (${filteredTwitter.length} posts after spam filter):`,
      filteredTwitter.map(p => `@${(p as any).username || 'unknown'}: ${p.text}`).join('\n'),
      `\nTelegram (${filteredTelegram.length} posts after spam filter):`,
      filteredTelegram.map(p => `[${(p as any).channel || 'unknown'}]: ${p.text}`).join('\n'),
    ].join('\n');

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
        fudClaims = [fudClaimsRaw];
      }
    }

    console.log('🧠 [STEP B] Noise Filter output array length:', fudClaims.length);

    // ── Build source statuses map ────────────────────────────
    const contextBase = {
      orderBook, perpData, dexData, securityGoPlus, securityRugCheck,
      twitterIntel, telegramIntel, coingeckoMarkets, coingeckoMacro,
      defillamaProtocols,
    };
    const sourceStatuses = buildSourceStatuses(contextBase);

    console.log('📡 [Pipeline] Source statuses:', JSON.stringify(sourceStatuses));

    // ── Build pipeline context ───────────────────────────────
    const pipelineContext: PipelineContext = {
      coinSymbol,
      contractAddress,
      chainId,
      ...contextBase,
      fudClaims,
      sourceStatuses,
      coordinationSignals,
    };

    // ── STEP C-G: Multi-Step MCTS ────────────────────────────
    console.log('⚙️ [STEP C-G] Multi-Step MCTS reasoning (≥5 LLM calls)...');
    let verdict: VerdictResult;
    try {
      verdict = await runMultiStepMCTS(pipelineContext, logger);
    } catch (err: any) {
      console.error('[Pipeline] Heavyweight engine permanently failed:', err.message);
      return makeDegradedVerdict(err.message, logger);
    }

    console.log(`[Pipeline] Analysis complete. Verdict: ${verdict.executable_verdict}, Drama Index: ${verdict.drama_index}`);
    return verdict;

  } catch (error) {
    console.error('[Pipeline] executeFudAnalysis threw a fatal error:', error);
    return FATAL_FALLBACK;
  }
}
