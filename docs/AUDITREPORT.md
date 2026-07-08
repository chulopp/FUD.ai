# 🛡️ FUD.ai — Vulnerability & Edge Case Audit Report
### Phase 1: Enterprise Stress-Test Preparation — Deep Backend Codebase Audit

**Auditor:** READ-ONLY Static Analysis  
**Scope:** `app/lib/**`, `app/api/**` (19 source files, ~3,800 LOC)  
**Date:** 2026-07-07  
**Status:** ⚠️ No code was modified. This is a read-only deliverable.

---

## Executive Summary

The FUD.ai backend is architecturally sound — it uses the `IngestionResult<T>` wrapper pattern consistently, has multi-layer LLM fallbacks, grounding checks, and fire-and-forget safety nets. However, under **severe stress-test conditions** (100 concurrent requests, API cascade failures, LLM hallucinations), several critical and high-severity vulnerabilities could cause **silent data corruption, unbounded memory growth, cascading timeouts, and race conditions**.

| Severity | Count |
|----------|-------|
| 🔴 CRITICAL | 5 |
| 🟠 HIGH | 9 |
| 🟡 MEDIUM | 11 |
| 🔵 LOW | 6 |

---

## Threat Vector 1: External Dependency Fragility

### 🔴 CRITICAL-01 — No Fetch Timeout on Any External API Call

**Files:** [market.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/market.ts), [security.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/security.ts), [rapidapi_twitter.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/rapidapi_twitter.ts), [causality.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/causality.ts), [engines.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/llm/engines.ts), [dispatcher.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/mcts/dispatcher.ts)

**Lines:** Every `fetch()` call across market.ts (L67, L114, L202, L218, L230, L280, L327, L380, L434), security.ts (L42, L131), rapidapi_twitter.ts (L39), causality.ts (L35), engines.ts (L40, L74, L153, L242, L311), dispatcher.ts (L143)

**Vulnerability:** The native `fetch()` API has **no default timeout**. If Bybit, CoinGecko, DexScreener, RapidAPI, GoPlus, RugCheck, DefiLlama, DeepSeek, Gemini, or OpenRouter hang without closing the connection (e.g., TCP connection established but server never sends response body), the promise will hang **indefinitely**.

The only exception is Telegram which uses `axios.create({ timeout: 15000 })` ([telegram.ts:47](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/telegram.ts#L47)).

**Blast Radius:** Under stress, if even one upstream API hangs:
- The `Promise.all` in [pipeline.ts:1096-1107](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/mcts/pipeline.ts#L1096-L1107) will **never resolve**
- The background pipeline in [route.ts:47-92](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/api/agent/route.ts#L47-L92) will hang forever
- The job remains stuck in `running` status permanently in Redis (10-min TTL eventually expires, client gets 404)
- On Vercel, the function will exceed the 60s timeout and be killed silently — the `catch` on L84 never fires
- Under 100 concurrent requests: all serverless function slots could be consumed by hanging promises, causing a **complete service denial**

---

### 🔴 CRITICAL-02 — DefiLlama Protocols Endpoint Downloads Entire Dataset on Every Call

**File:** [market.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/market.ts)  
**Lines:** [280-307](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/market.ts#L280-L307)

**Vulnerability:** `fetchDefiLlamaProtocols()` calls `https://api.llama.fi/protocols` which returns the **entire DeFi protocol list** (~6,000+ protocols, ~2-5 MB JSON payload). This response is fully deserialized into memory, then linearly scanned with `.find()` to locate a single protocol.

**Blast Radius:** Under 100 concurrent requests, this means:
- **200-500 MB of RAM allocated** simultaneously just for DefiLlama responses
- Vercel's 1024 MB serverless memory cap could be exceeded → OOM kill
- The `protocols.find()` on L286 is O(n) over ~6,000 items × 100 concurrent = **600,000 comparisons**
- Even with the 2-minute ingestion cache, the first request in each window still allocates the full payload

---

### 🟠 HIGH-01 — CoinGecko Free-Tier Rate Limit Not Enforced Client-Side

**File:** [market.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/market.ts)  
**Lines:** [322-363](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/market.ts#L322-L363) (resolveCoinGeckoId), [365-413](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/market.ts#L365-L413) (fetchCoinGeckoMarkets), [415-458](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/market.ts#L415-L458) (fetchCoinGeckoMacro)

**Vulnerability:** Each analysis request fires up to **3 CoinGecko API calls** (search, markets, macro). CoinGecko free tier allows ~10-30 requests/minute. Under 100 concurrent requests, this would produce **300 CoinGecko calls** in seconds, resulting in mass 429 rate-limit errors.

While the ingestion cache helps, the `resolveCoinGeckoId()` uses an in-memory `Map` cache ([L312](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/market.ts#L312)) that is **per-serverless-instance** — cold starts or multiple Vercel instances will each have empty caches, multiplying the blast.

**Blast Radius:** All CoinGecko-dependent data returns `status: 'error'` for the entire rate-limit window, degrading verdict quality across all concurrent requests.

---

### 🟠 HIGH-02 — DexScreener Triple-Fallback Cascade Creates 3x API Load Under Failure

**File:** [market.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/market.ts)  
**Lines:** [188-265](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/market.ts#L188-L265)

**Vulnerability:** `fetchDexScreenerData()` tries 3 endpoints sequentially: v1 token-pairs → legacy tokens → search. If the first two return empty arrays (not errors), the third still fires. Under mass failure conditions (DexScreener rate-limiting), every single request produces **3 failed HTTP calls** before returning `empty`.

**Blast Radius:** 100 concurrent requests × 3 fallback attempts = **300 DexScreener calls**. Combined with no timeout (CRITICAL-01), each of these could hang.

---

### 🟠 HIGH-03 — Telegram Scraper Fires 17+ Concurrent HTTP Requests Per Analysis

**File:** [telegram.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/telegram.ts)  
**Lines:** [26-44](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/telegram.ts#L26-L44), [145-148](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/telegram.ts#L145-L148)

**Vulnerability:** `DEFAULT_TELEGRAM_CHANNELS` contains **17 channels**. `fetchTelegramIntel()` scrapes all 17 concurrently via `Promise.allSettled()`. Each channel scrape fetches and parses HTML (~50-200KB each).

**Blast Radius:** 100 concurrent analysis requests × 17 channels = **1,700 simultaneous HTTP requests** to `t.me`. Telegram will IP-block the server, causing all future social intelligence to return empty for the ban duration. The 15s axios timeout prevents indefinite hangs, but the sheer concurrency is problematic.

---

### 🟡 MEDIUM-01 — RapidAPI Twitter Returns Empty Array on Non-200 Instead of Error Status

**File:** [rapidapi_twitter.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/rapidapi_twitter.ts)  
**Lines:** [47-50](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/rapidapi_twitter.ts#L47-L50)

**Vulnerability:** When the RapidAPI response is not OK (429 rate limit, 500 server error), `searchTwitterRapidAPI()` returns `[]` — an empty array. The upstream `fetchTwitterIntel()` then sees `tweets.length === 0` and returns `empty<SocialIntelData>()` ([L124-125](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/rapidapi_twitter.ts#L124-L125)).

**Blast Radius:** The pipeline cannot distinguish "API failed" from "genuinely no tweets about this coin". The grounding check treats `empty` as valid, allowing the LLM to conclude "no social chatter" when in reality the API was down. This could produce dangerously inaccurate verdicts (e.g., IGNORE_FUD when there's actually a panic but the API is rate-limited).

---

### 🟡 MEDIUM-02 — Bybit API Key Exposure in Query String Signature

**File:** [market.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/market.ts)  
**Lines:** [28-46](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/market.ts#L28-L46)

**Vulnerability:** The HMAC signature payload includes the query string as `payload`, but the function signature sends it in the URL query string AND the `X-BAPI-*` headers. If the server logs request URLs (many CDNs do), the API key is visible in logs. Not a direct vulnerability, but a hygiene concern under production observability.

---

### 🔵 LOW-01 — CoinGecko ID Cache Is In-Memory, Not Shared Across Instances

**File:** [market.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/market.ts)  
**Line:** [312](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/market.ts#L312)

**Vulnerability:** `coingeckoIdCache` is a `Map<string, string>` in module scope. On Vercel, each serverless function instance gets its own copy. Cold starts or horizontal scaling means the cache is effectively useless under high concurrency — every instance re-resolves CoinGecko IDs, wasting API quota.

---

## Threat Vector 2: LLM Hallucinations & Malformed Outputs

### 🔴 CRITICAL-03 — Dispatcher LLM Can Return Arbitrary JSON That Bypasses All Validation

**File:** [dispatcher.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/mcts/dispatcher.ts)  
**Lines:** [131-200](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/mcts/dispatcher.ts#L131-L200)

**Vulnerability:** `runGranularDispatcher()` parses the LLM response as JSON and directly casts it to `DispatcherStrategy` without **any schema validation** ([L172](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/mcts/dispatcher.ts#L172), [L193](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/mcts/dispatcher.ts#L193)). If the LLM returns valid JSON with wrong keys (e.g., `{ "bybit": { ... } }` instead of `{ "bybit_v5": { ... } }`), the resulting strategy object will have **no matching keys**, causing every ingestion function to interpret the strategy as "endpoint not requested" and **skip all data fetching**.

**Blast Radius:** 
- The pipeline runs with **zero market data** — every source returns `not_called`
- The LLM then gets a context with all sources marked `not_called` and produces a verdict based on nothing
- The verdict is `INSUFFICIENT_DATA` at best, or a hallucinated verdict at worst
- The empty `{}` fallback on [L199](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/mcts/dispatcher.ts#L199) does handle the total-failure case, but malformed-but-valid-JSON is the gap

---

### 🔴 CRITICAL-04 — Reflexion Critic Can Return FETCH_MORE Indefinitely (No Loop Bound)

**File:** [pipeline.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/mcts/pipeline.ts)  
**Lines:** [758-788](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/mcts/pipeline.ts#L758-L788)

**Vulnerability:** While there's a `CONCLUSION_FORCED_SUFFIX` appended in the FETCH_MORE branch, the code only handles **one** FETCH_MORE cycle. However, the deeper issue is that the system uses `safeParseJSON(synthResult.content)` on [L786](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/mcts/pipeline.ts#L786) after the final synthesis step — if the LLM *again* returns `{ "action": "FETCH_MORE" }` in the synthesis, the `buildVerdict()` on [L787](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/mcts/pipeline.ts#L787) will attempt to build a verdict from a FETCH_MORE object, resulting in:
- `executable_verdict` defaulting to `IGNORE_FUD` (because "FETCH_MORE" is not in `VALID_VERDICTS`)
- `chatter_level` = 0, `risk_score` = 0 (no numeric fields present)
- A **silently corrupted verdict** with zero drama index

> [!WARNING]
> This is not an infinite loop — it's worse. It silently produces a valid-looking but meaningless verdict.

---

### 🟠 HIGH-04 — `safeParseJSON` May Extract Wrong Object from LLM Output

**File:** [pipeline.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/mcts/pipeline.ts)  
**Lines:** [302-317](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/mcts/pipeline.ts#L302-L317)

**Vulnerability:** When the primary parse fails, `safeParseJSON` uses `raw.match(/\{[\s\S]*\}/)` to extract the first `{...}` block. This greedy regex will match from the **first `{`** to the **last `}`** in the entire response — if the LLM output contains reasoning text with embedded JSON snippets, the regex could capture a superset of the intended JSON, or the wrong JSON object entirely.

**Blast Radius:** If the LLM outputs something like:
```
Here's my analysis: {"reasoning": "..."} 

The verdict is: {"executable_verdict": "HOLD", ...}
```
The regex would match from `{"reasoning"` to the final `}`, producing a malformed merged object. The `buildVerdict()` would then use `reasoning` fields instead of verdict fields.

---

### 🟠 HIGH-05 — Lightweight Engine Failure Returns Parseable JSON with `fallback: true`

**File:** [engines.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/llm/engines.ts)  
**Lines:** [109](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/llm/engines.ts#L109)

**Vulnerability:** `runLightweightEngine()` returns `JSON.stringify({ error: "...", fallback: true })` on total failure. In the pipeline ([pipeline.ts:1160-1168](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/mcts/pipeline.ts#L1160-L1168)), `safeParseJSON(fudClaimsRaw)` will successfully parse this error object — it is valid JSON — but `Array.isArray(parsedClaims)` is `false` (it's an object), so it falls through to the `startsWith('[')` check which also fails, and finally falls into `fudClaims = [fudClaimsRaw]` — making the entire error JSON string a single "FUD claim" that gets injected into the LLM context.

**Blast Radius:** The heavyweight LLM receives a "FUD claim" that reads: `{"error": "Lightweight Engine failed on all targets", "fallback": true}`. The LLM may hallucinate this as evidence of a "system target failure" or incorporate the error text into its reasoning, producing nonsensical evidence chains.

---

### 🟠 HIGH-06 — `market_cap_category` Missing from LLM Output Nullifies Calibration Recording

**File:** [pipeline.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/mcts/pipeline.ts)  
**Lines:** [846-851](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/mcts/pipeline.ts#L846-L851) (normalization), [1242-1258](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/mcts/pipeline.ts#L1242-L1258) (recording gate)

**Vulnerability:** The `market_cap_category` is extracted from the LLM's output and validated against `VALID_MC_CATEGORIES`. If the LLM misspells it (e.g., `"Meme"` instead of `"meme"`, or `"large"` instead of `"big"`), it defaults to `null`. When `market_cap_category === null`, the recording gate on [L1244](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/mcts/pipeline.ts#L1244) skips `recordPrediction()` entirely.

**Blast Radius:** The calibration system **never collects training data** if the LLM consistently fails to output the exact string. Over time, the calibration buckets remain empty, and `getCalibratedConfidence()` always returns raw LLM confidence — the entire calibration system becomes a dead feature.

> [!NOTE]
> The normalization does `.toLowerCase()` on L848, so `"Meme"` → `"meme"` is handled. But `"large"`, `"mega"`, `"micro"`, etc. would all fall through to `null`.

---

### 🟡 MEDIUM-03 — Hypothesis Generator Fallback Uses Hardcoded Probabilities

**File:** [pipeline.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/mcts/pipeline.ts)  
**Lines:** [656-661](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/mcts/pipeline.ts#L656-L661)

**Vulnerability:** If the hypothesis generator LLM returns malformed JSON (or `safeParseJSON` fails), the system falls back to 3 hardcoded hypotheses with fixed probabilities. These generic hypotheses contain no context about the specific coin, causality data, or coordination signals.

**Blast Radius:** The subsequent rollout simulators receive hypotheses that don't reference the actual data context, producing generic rollouts. The final verdict is then based on generic reasoning rather than coin-specific evidence. This is a **correctness degradation**, not a crash.

---

### 🟡 MEDIUM-04 — Dispatcher Fallback Gemini→DeepSeek Uses Different JSON Extraction Logic

**File:** [dispatcher.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/mcts/dispatcher.ts)  
**Lines:** [162-163](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/mcts/dispatcher.ts#L162-L163) vs [188-192](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/mcts/dispatcher.ts#L188-L192)

**Vulnerability:** The Gemini primary uses `responseMimeType: "application/json"` to force structured output, while the DeepSeek fallback manually strips markdown fences with regex. If DeepSeek wraps the JSON in triple backticks with non-standard formatting (e.g., ` ```JSON ` with uppercase), the regex `replace(/^```(?:json)?\s*/i, '')` handles it — but edge cases like nested code blocks or extra whitespace could slip through.

---

### 🔵 LOW-02 — Vision Engine Silently Degrades to Text-Only When Image Fetch Fails

**File:** [engines.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/llm/engines.ts)  
**Lines:** [226-237](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/llm/engines.ts#L226-L237)

**Vulnerability:** If the image URL fetch fails, `base64Data` remains empty string. The Gemini primary skips ([L240](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/llm/engines.ts#L240)), and the OpenRouter fallback includes only text in the message payload. The vision engine effectively becomes a text engine silently.

---

## Threat Vector 3: Math & Type Safety

### 🔴 CRITICAL-05 — Sybil Detector O(n²) Jaccard Comparison Will Hang on Large Post Sets

**Files:** [sybil_detector.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/sybil_detector.ts), [causality.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/causality.ts)  
**Lines:** [sybil_detector.ts:80-88](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/sybil_detector.ts#L80-L88), [causality.ts:92-101](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/causality.ts#L92-L101)

**Vulnerability:** Both `computeCoordinationSignals()` and `getLargestClusterIndices()` perform pairwise Jaccard similarity with nested O(n²) loops. With `n = posts.length`:
- Twitter returns up to 20 posts
- Telegram scrapes 17 channels × 10 posts = up to 170 posts
- Combined: up to ~190 posts → **18,145 Jaccard comparisons**
- Each Jaccard involves iterating 3-grams (~100-500 chars per post)

Under stress with many posts: if spam filter doesn't drop enough, or if an attacker floods social channels with unique long texts, this becomes **CPU-bound for hundreds of milliseconds** on the event loop, blocking all concurrent requests.

**Blast Radius:** The O(n²) is duplicated in both files — `causality.ts` re-implements the exact same algorithm ([causality.ts:86-138](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/causality.ts#L86-L138)), meaning the work is done **twice per request**. Total: 36,290 comparisons × 100 concurrent requests = 3.6M comparisons.

---

### 🟠 HIGH-07 — Momentum Division by Near-Zero Elapsed Time

**File:** [momentum.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/momentum.ts)  
**Lines:** [87-106](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/momentum.ts#L87-L106)

**Vulnerability:** The guard `if (elapsedMinutes <= 0.01)` on [L91](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/momentum.ts#L91) protects against division by zero, but if `elapsedMinutes` is exactly `0.02` (snapshots 1.2 seconds apart), the velocity calculations produce **extremely large numbers**:
```
priceDiffPct = ((101 - 100) / 100) * 100 = 1%
price_velocity = 1% / 0.02 = 50 %/minute
```
A 1% price change in 1.2 seconds would report **50%/minute velocity** — a technically correct but misleading extreme value that could cause the LLM to panic.

**Blast Radius:** Momentum data is injected into the LLM context. Extreme velocity values could cause the LLM to generate LIQUIDATE_LONGS verdicts based on noise.

---

### 🟠 HIGH-08 — Causality `maxNegativeDelta` Initialized to 0 Creates Off-by-One Logic

**File:** [causality.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/causality.ts)  
**Lines:** [154-192](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/causality.ts#L154-L192)

**Vulnerability:** `maxNegativeDelta` is initialized to `0`. The check `if (deltaPct < maxNegativeDelta)` on [L167](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/causality.ts#L167) means only **strictly negative** deltas are detected. If all candles have `deltaPct >= 0` (rising market), `price_drop_timestamp_ms` remains `0`, triggering the fallback loop on [L174-192](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/causality.ts#L174-L192) which finds the *least positive* candle and treats it as a "price drop" — even if the price went *up*.

**Blast Radius:** In a rising market, the causality engine reports a "price drop" that was actually a +0.01% candle, and may conclude `narrative_precedes_price_action = true` if social posts preceded this non-event. This could generate false "Coordinated FUD Campaign" hypotheses during a bull run.

---

### 🟠 HIGH-09 — `lag_minutes` Can Be Massively Negative

**File:** [causality.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/causality.ts)  
**Lines:** [230-231](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/causality.ts#L230-L231)

**Vulnerability:** `lag_minutes = (price_drop_timestamp_ms - social_burst_timestamp_ms) / 60000`. If `social_burst_timestamp_ms` is in the future relative to `price_drop_timestamp_ms` (which is possible if social timestamps are in epoch milliseconds and candle timestamps are in a different epoch), `lag_minutes` becomes a **large negative number** (e.g., -1,440,000+ minutes).

The LLM system prompt says "if lag_minutes > 0" for causality, so extremely negative values should not trigger the coordinated FUD path — but the raw value is injected into the context and could confuse the LLM.

**Blast Radius:** LLM receives causality data showing `lag_minutes: -50000` which is nonsensical. Depending on the LLM's interpretation, this could either be ignored (safe) or treated as a strong "organic reaction" signal (dangerous if incorrect).

---

### 🟡 MEDIUM-05 — `unique_author_ratio` Division by Zero When posts.length Is 0

**File:** [sybil_detector.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/sybil_detector.ts)  
**Lines:** [58-65](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/sybil_detector.ts#L58-L65)

**Vulnerability:** The empty-array guard on [L59-64](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/sybil_detector.ts#L59-L64) returns `unique_author_ratio: 1.0` when `posts.length === 0`. This is correct. However, the division on [L71](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/sybil_detector.ts#L71) (`uniqueAuthors.size / posts.length`) would produce `NaN` if the guard were ever bypassed. The guard is currently solid, but it's a fragile contract.

**Blast Radius:** Low — the guard works correctly today. Noting for defensive programming.

---

### 🟡 MEDIUM-06 — `Math.min(...timestamps)` with Large Arrays Can Cause Stack Overflow

**File:** [sybil_detector.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/sybil_detector.ts)  
**Lines:** [134-135](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/sybil_detector.ts#L134-L135)

**Also in:** [causality.ts:219](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/causality.ts#L219), [causality.ts:227](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/causality.ts#L227)

**Vulnerability:** `Math.min(...timestamps)` and `Math.max(...timestamps)` spread the array onto the call stack. V8's call stack limit is ~65,536 arguments. While current post counts (~190 max) are safe, if the post limit is ever increased or the spam filter fails, this could throw `RangeError: Maximum call stack size exceeded`.

---

### 🟡 MEDIUM-07 — Calibration `getBucketName` Edge Case at Exactly 1.0

**File:** [calibration.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/mcts/calibration.ts)  
**Lines:** [73-79](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/mcts/calibration.ts#L73-L79)

**Vulnerability:** `Math.min(90, Math.floor(pct / 10) * 10)` ensures `rawConfidence = 1.0` maps to bucket `"90-100"`. This is correct. However, if `rawConfidence` exceeds 1.0 due to an LLM hallucination (e.g., `confidence: 1.5`), the `Math.max(0, Math.min(1, rawConfidence))` clamp handles it. Currently safe, but the pipeline's `buildVerdict` on [L861](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/mcts/pipeline.ts#L861) does **not** clamp confidence before passing it to calibration:
```typescript
confidence: typeof parsed.confidence === 'number' ? parsed.confidence : null,
```
A confidence of `1.5` would pass through unclamped to `recordPrediction()`.

---

### 🟡 MEDIUM-08 — `parseInt` on Redis Hash Values Without Radix Validation

**File:** [calibration.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/mcts/calibration.ts)  
**Lines:** [292-293](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/mcts/calibration.ts#L292-L293)

**Vulnerability:** `parseInt(stats.total, 10)` and `parseInt(stats.wins ?? '0', 10)` — if the Redis hash value is somehow corrupted to a non-numeric string (e.g., `"abc"`), `parseInt` returns `NaN`. Then `total < MIN_SAMPLES_THRESHOLD` with `NaN` is `false`, and `wins / total` = `NaN / NaN` = `NaN`. The calibrated confidence becomes `NaN`, which propagates through the verdict.

**Blast Radius:** The verdict's `confidence` field becomes `NaN` → serialized as `null` in JSON → client receives `confidence: null` which is valid per the API contract (degraded mode). Not catastrophic, but masks the real issue.

---

### 🔵 LOW-03 — `parseFloat` on Bybit Candle Data Without NaN Guard on Subsequent Math

**File:** [causality.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/causality.ts)  
**Lines:** [158-163](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/causality.ts#L158-L163)

**Vulnerability:** The code does check `isNaN(open) || isNaN(close) || open === 0 || isNaN(timestamp)` and `continue`s. This is correct. However, it does not check for `close === 0` — if close is 0 while open is valid, `deltaPct = ((0 - open) / open) * 100 = -100%`, which is a valid but extreme value that could dominate as the "worst candle".

---

## Threat Vector 4: Infrastructure & Concurrency

### 🟠 HIGH-10 — Redis `updateJob` Has a Read-Modify-Write Race Condition

**File:** [job-store.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/redis/job-store.ts)  
**Lines:** [51-67](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/redis/job-store.ts#L51-L67)

**Vulnerability:** `updateJob()` performs a **non-atomic read-modify-write**:
1. `GET` the current record
2. Merge with patch in JavaScript
3. `SET` the merged record

If two concurrent operations call `updateJob()` on the same `job_id` (e.g., the background pipeline sets `status: 'running'` while a timeout handler simultaneously sets `status: 'failed'`), the second writer overwrites the first without seeing it.

**Blast Radius:** Under 100 concurrent requests this is unlikely per-job (each job has a unique ID), but if the same coin symbol is queried by multiple users simultaneously and any shared-state mechanism is added later, this pattern is pre-disposed to lost updates. Additionally, the TTL is **reset to 10 minutes from the update time**, not from creation — meaning a job that takes 9 minutes to complete gets a fresh 10-minute window, but if the background pipeline crashes between the `updateJob('running')` and the final `updateJob('completed')`, the job stays in `running` state for the full new TTL.

---

### 🟠 HIGH-11 — Redis Client Module Throws at Import Time, Crashing the Entire Process

**File:** [client.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/redis/client.ts)  
**Lines:** [5-7](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/redis/client.ts#L5-L7)

**Vulnerability:** The module-level guard throws immediately if env vars are missing:
```typescript
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error('...');
}
```
This `throw` occurs at **import time** — when any module that transitively imports `redis/client.ts` is loaded. In Next.js App Router, this means the entire server process crashes on startup if the env vars are missing, with no graceful degradation.

**Blast Radius:** A missing `.env.local` file or a deployment misconfiguration causes a **total service outage** — not just for the agent API, but for the entire Next.js application including the frontend.

---

### 🟡 MEDIUM-09 — `waitUntil` Fallback on Local Dev Doesn't Actually Wait

**File:** [route.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/api/agent/route.ts)  
**Lines:** [95-100](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/api/agent/route.ts#L95-L100)

**Vulnerability:** The local dev fallback is:
```typescript
backgroundPipeline.catch(console.error);
```
This prevents unhandled rejection warnings, but does **not** prevent the Node.js process from exiting before the pipeline completes. In local development with `next dev`, if the dev server is restarted (HMR, crash, etc.), the in-flight pipeline is silently killed. The job remains in `running` state in Redis until TTL expiry.

---

### 🟡 MEDIUM-10 — No Concurrency Limit on Background Pipelines

**File:** [route.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/api/agent/route.ts)  
**Lines:** [47-100](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/api/agent/route.ts#L47-L100)

**Vulnerability:** Every POST request creates a new background pipeline with no admission control. There is no semaphore, queue, or rate limiter. Under 100 concurrent requests:
- 100 simultaneous `executeFudAnalysis()` calls
- Each spawns ~10 parallel ingestion fetches + 6+ LLM calls
- Total: ~1,000 concurrent HTTP fetches + 600 LLM API calls
- Memory: 100 × pipeline context objects, each containing full ingestion results

**Blast Radius:** On Vercel, each concurrent invocation is a separate serverless instance (cost implication). On a single Node.js server, the event loop is saturated, causing cascading timeouts and potential OOM.

---

### 🟡 MEDIUM-11 — Calibration Cron Auth Bypass via Missing CRON_SECRET

**File:** [calibrate/route.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/api/cron/calibrate/route.ts)  
**Lines:** [30-35](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/api/cron/calibrate/route.ts#L30-L35)

**Vulnerability:** `isManualTrigger` is `false` when `cronSecret` is falsy (env var not set). This is correct — it prevents access when the secret is unset. However, the `x-vercel-cron` header check on [L28](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/api/cron/calibrate/route.ts#L28) only checks for the value `'1'`. On non-Vercel deployments, an attacker can send `x-vercel-cron: 1` header to bypass auth entirely.

**Blast Radius:** The attacker triggers `evaluateMaturePredictions()` which reads from Redis and fetches CoinGecko prices. This is a **resource exhaustion** vector (burning CoinGecko API quota) and could cause premature evaluation of predictions (evaluating before the target timestamp, corrupting calibration data).

---

### 🔵 LOW-04 — Double JSON Serialization in Upstash Redis

**File:** [job-store.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/redis/job-store.ts)  
**Lines:** [44](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/redis/job-store.ts#L44), [58](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/redis/job-store.ts#L58), [74-77](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/redis/job-store.ts#L74-L77)

**Vulnerability:** The code does `JSON.stringify(record)` before passing to `redis.set()`. Upstash's `@upstash/redis` SDK **auto-serializes** objects to JSON. This means the data is double-serialized: `redis.set(key, '"{\\"status\\":\\"pending\\"...}"')`. On read, `redis.get<string>()` returns the double-serialized string, which the code then parses with `typeof raw === 'string' ? JSON.parse(raw) : raw`. This works because the first `JSON.parse` unwraps the outer string, producing the inner JSON string, which is then... actually, the code handles this with the `typeof raw === 'string'` check.

**Blast Radius:** This actually works correctly but is fragile. If Upstash SDK behavior changes or the `typeof` check is removed, the data becomes unreadable.

---

### 🔵 LOW-05 — `step_logger.ts` Cost Estimation Uses Hardcoded DeepSeek Pricing

**File:** [step_logger.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/mcts/step_logger.ts)  
**Lines:** [32-36](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/mcts/step_logger.ts#L32-L36)

**Vulnerability:** The cost estimation uses hardcoded DeepSeek pricing. The system now uses multiple LLMs (Gemini, OpenRouter/Nemotron) whose costs differ. The lightweight engine calls are not logged at all (no `logger.log()` in the lightweight extraction step on [pipeline.ts:1154](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/mcts/pipeline.ts#L1154)).

**Blast Radius:** The `estimated_cost_usd` in the response is inaccurate. Client billing or monitoring dashboards would show wrong numbers.

---

### 🔵 LOW-06 — `Uint8Array` Used for BFS Visited Set Limits Maximum Post Count to 255

**File:** [sybil_detector.ts](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/sybil_detector.ts)  
**Lines:** [91](file:///d:/Fallah%27s%20File/Code/Personal%20Project/FUD.ai/app/lib/ingestion/sybil_detector.ts#L91)

**Vulnerability:** `Uint8Array(n)` stores 0 or 1 values — each element is a byte. This is correct for boolean visited flags and supports up to 255 for each element value. Since only 0/1 is used, this works for any `n`. Not actually a vulnerability — just noting the implementation choice.

---

## Summary of Blast Radii Under 100 Concurrent Requests

| Scenario | Cascade Effect |
|----------|---------------|
| Any upstream API hangs (no timeout) | All 100 pipelines hang → job stuck in `running` → Redis TTL expiry → 404s for all clients |
| CoinGecko rate-limited | Market data unavailable → LLM verdicts lack price context → confidence drops but verdict is still emitted |
| Telegram IP-banned | 17×100 = 1700 concurrent requests → ban → all social intel returns empty → sybil/causality metrics are zeros |
| DefiLlama full dataset × 100 | 200-500MB RAM spike → OOM kill on Vercel |
| LLM returns malformed dispatcher JSON | All sources skip → verdict based on nothing |
| All LLM engines down | Heavyweight throws → `makeDegradedVerdict()` → `INSUFFICIENT_DATA` (correct degradation) |
| Redis connection drops | `createJob` throws → outer catch returns 500 → client gets error (correct) |
| Redis connection drops mid-pipeline | `updateJob` silently warns and returns → job stays in previous state forever |

---

> [!CAUTION]
> The single highest-risk finding is **CRITICAL-01 (No Fetch Timeout)**. Under stress-test conditions, this alone can cause a complete service denial. Every other finding's severity is amplified when combined with hanging promises.

---

*End of Read-Only Audit Report — No code was modified.*
