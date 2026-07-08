/**
 * CROO CAP Protocol Provider Worker
 *
 * This is a LONG-RUNNING PROCESS — NOT a Next.js API route.
 * Deploy to Railway (single replica) using:
 *   npx tsx scripts/croo-provider-worker.ts
 *
 * Required environment variables:
 *   CROO_API_URL      https://api.croo.network
 *   CROO_WS_URL       wss://api.croo.network/ws
 *   CROO_SDK_KEY      croo_sk_...
 *
 * Also requires all vars consumed by executeFudAnalysis:
 *   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 *   OPENROUTER_API_KEY (or GEMINI_API_KEY), DEEPSEEK_API_KEY
 *   ... (full list in .env.example)
 *
 * Architecture:
 *   ┌──────────────────────────────────────────────────┐
 *   │  CROO WebSocket (auto-reconnect, exponential backoff)
 *   │    │
 *   │    ├─ NegotiationCreated
 *   │    │    → parse requirements JSON
 *   │    │    → validate coin_symbol
 *   │    │    → rejectNegotiation() if invalid
 *   │    │    → acceptNegotiation() if valid
 *   │    │    → store params in memory + Redis
 *   │    │
 *   │    └─ OrderPaid
 *   │         → lookup params (memory → Redis fallback)
 *   │         → waitForPipelineSlot() [queue, never reject]
 *   │         → executeFudAnalysis()
 *   │         → SLA watchdog: degrade at 480s if not done
 *   │         → deliverOrder() with 8-field schema
 *   └──────────────────────────────────────────────────┘
 *
 * IMPORTANT: Deploy as a SINGLE REPLICA.
 * CROO enforces 1 API Key = 1 active WebSocket.
 * A second instance with the same CROO_SDK_KEY will be
 * rejected with code 1008.
 */

// ── Load .env.local in development ──────────────────────────
// tsx respects dotenv; in production (Railway), set env vars
// in the Railway dashboard instead.
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

dotenvConfig({ path: resolve(process.cwd(), '.env.local') });

import { AgentClient, EventType, DeliverableType } from '@croo-network/sdk';
import { executeFudAnalysis } from '../app/lib/mcts/pipeline';
import { stripToDeliverableSchema, buildDegradedDeliverable } from '../app/lib/utils/croo-schema';
import { waitForPipelineSlot, releasePipelineSlot } from '../app/lib/redis/concurrency';
import { redis } from '../app/lib/redis/client';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** SLA registered on Dashboard: 10 minutes */
const SLA_SECONDS = 600;

/** Trigger degradation watchdog at 8 minutes (80% of SLA) */
const SLA_WATCHDOG_SECONDS = 480;

/** Max time to wait for a concurrency slot before considering degradation */
const SLOT_WAIT_TIMEOUT_MS = (SLA_WATCHDOG_SECONDS - 30) * 1000; // 450s — leave 30s for execution

/** Redis key prefix for persisting negotiation params across reconnects */
const NEG_PARAMS_KEY_PREFIX = 'croo:neg:';
const ORDER_PARAMS_KEY_PREFIX = 'croo:order:';
const PARAMS_TTL_SECONDS = SLA_SECONDS * 2; // 20 min — generous buffer

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface AnalysisParams {
  coin_symbol: string;
  contract_address?: string;
  chain_id?: string;
}

// ─────────────────────────────────────────────────────────────
// In-memory state (survives reconnects within the same process)
// ─────────────────────────────────────────────────────────────

/** negotiationId → analysis params (primary storage) */
const pendingNegotiations = new Map<string, AnalysisParams>();

/** orderId → analysis params (set at acceptNegotiation time) */
const pendingOrders = new Map<string, AnalysisParams>();

/** orderId → SLA watchdog timer */
const slaWatchdogs = new Map<string, ReturnType<typeof setTimeout>>();

/** orderId → set when pipeline completes so watchdog can cancel cleanly */
const completedOrders = new Set<string>();

// ─────────────────────────────────────────────────────────────
// Structured logger
// ─────────────────────────────────────────────────────────────

function log(level: 'INFO' | 'WARN' | 'ERROR', msg: string, data?: unknown) {
  const ts = new Date().toISOString();
  const prefix = `[CROO-Worker][${ts}][${level}]`;
  if (data !== undefined) {
    console[level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log'](prefix, msg, data);
  } else {
    console[level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log'](prefix, msg);
  }
}

// ─────────────────────────────────────────────────────────────
// Redis helpers for cross-reconnect state persistence
// ─────────────────────────────────────────────────────────────

async function persistNegotiationParams(negId: string, params: AnalysisParams): Promise<void> {
  try {
    await redis.set(`${NEG_PARAMS_KEY_PREFIX}${negId}`, params, { ex: PARAMS_TTL_SECONDS });
  } catch (err) {
    log('WARN', `Failed to persist neg params for ${negId}`, err);
  }
}

async function persistOrderParams(orderId: string, params: AnalysisParams): Promise<void> {
  try {
    await redis.set(`${ORDER_PARAMS_KEY_PREFIX}${orderId}`, params, { ex: PARAMS_TTL_SECONDS });
  } catch (err) {
    log('WARN', `Failed to persist order params for ${orderId}`, err);
  }
}

async function lookupOrderParams(
  orderId: string,
  client: AgentClient
): Promise<AnalysisParams | null> {
  // 1. In-memory (fast path, survives reconnects within same process lifetime)
  const inMemory = pendingOrders.get(orderId);
  if (inMemory) return inMemory;

  // 2. Redis (survives process restarts — covers edge case of worker restart mid-order)
  try {
    const fromRedis = await redis.get<AnalysisParams>(`${ORDER_PARAMS_KEY_PREFIX}${orderId}`);
    if (fromRedis) {
      log('INFO', `[Recovery] Loaded order params from Redis for ${orderId}`);
      pendingOrders.set(orderId, fromRedis); // re-populate memory
      return fromRedis;
    }
  } catch (err) {
    log('WARN', `Redis lookup failed for order ${orderId}`, err);
  }

  // 3. Fetch via SDK (last resort — requires a network round-trip to CROO API)
  try {
    log('WARN', `[Recovery] Fetching order ${orderId} from CROO API (no local state found)`);
    const order = await client.getOrder(orderId);
    const neg = await client.getNegotiation(order.negotiationId!);
    if (neg?.requirements) {
      const parsed = safeParseRequirements(neg.requirements);
      if (parsed) {
        pendingOrders.set(orderId, parsed);
        await persistOrderParams(orderId, parsed);
        return parsed;
      }
    }
  } catch (err) {
    log('ERROR', `Failed to recover params for order ${orderId} via API`, err);
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// Input validation
// ─────────────────────────────────────────────────────────────

/**
 * coin_symbol validation rules:
 *   - Must be present and non-empty
 *   - 1–20 characters
 *   - Alphanumeric (letters and digits only, no spaces or special chars)
 *   - Case-insensitive (stored as uppercase)
 *
 * Returns null if invalid with a human-readable reason.
 */
function validateCoinSymbol(symbol: unknown): { valid: true; symbol: string } | { valid: false; reason: string } {
  if (!symbol || typeof symbol !== 'string') {
    return { valid: false, reason: 'coin_symbol is required and must be a string.' };
  }
  const trimmed = symbol.trim();
  if (trimmed.length === 0) {
    return { valid: false, reason: 'coin_symbol cannot be empty or whitespace.' };
  }
  if (trimmed.length > 20) {
    return { valid: false, reason: `coin_symbol too long (${trimmed.length} chars, max 20).` };
  }
  if (!/^[A-Za-z0-9]+$/.test(trimmed)) {
    return {
      valid: false,
      reason: `coin_symbol contains invalid characters: "${trimmed}". Only alphanumeric characters are allowed.`,
    };
  }
  return { valid: true, symbol: trimmed.toUpperCase() };
}

/**
 * Safely parses the negotiation requirements JSON string.
 * The Requester sends: '{"coin_symbol":"BTC","contract_address":"0x...","chain_id":"1"}'
 */
function safeParseRequirements(requirements: string): AnalysisParams | null {
  try {
    const parsed = typeof requirements === 'string' ? JSON.parse(requirements) : requirements;
    if (parsed && typeof parsed === 'object') {
      return {
        coin_symbol: parsed.coin_symbol,
        contract_address: parsed.contract_address,
        chain_id: parsed.chain_id,
      };
    }
  } catch {
    // fall through
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// SLA Watchdog
// ─────────────────────────────────────────────────────────────

/**
 * Starts a SLA watchdog timer for an order.
 *
 * If the pipeline hasn't completed by SLA_WATCHDOG_SECONDS (480s),
 * the watchdog delivers a degraded result preemptively.
 *
 * This ensures:
 *   - The requester gets a response instead of an auto-refund
 *   - FUD.ai's reputation isn't damaged by silent SLA breaches
 *   - We demonstrate graceful degradation capability
 */
function startSlaWatchdog(orderId: string, client: AgentClient): void {
  const timer = setTimeout(async () => {
    if (completedOrders.has(orderId)) {
      log('INFO', `[SLA-Watchdog] Order ${orderId} already completed — watchdog cancelled`);
      return;
    }

    log('WARN', `[SLA-Watchdog] Order ${orderId} approaching SLA limit (${SLA_WATCHDOG_SECONDS}s). Delivering degraded result.`);

    try {
      const degraded = buildDegradedDeliverable('pipeline_sla_timeout');
      await client.deliverOrder(orderId, {
        type: DeliverableType.Schema,
        data: degraded as Record<string, unknown>,
      });
      completedOrders.add(orderId);
      log('INFO', `[SLA-Watchdog] Degraded delivery submitted for order ${orderId}`);
    } catch (err) {
      log('ERROR', `[SLA-Watchdog] Failed to deliver degraded result for order ${orderId}`, err);
    } finally {
      slaWatchdogs.delete(orderId);
      pendingOrders.delete(orderId);
    }
  }, SLA_WATCHDOG_SECONDS * 1000);

  slaWatchdogs.set(orderId, timer);
  log('INFO', `[SLA-Watchdog] Started for order ${orderId} (fires in ${SLA_WATCHDOG_SECONDS}s)`);
}

function cancelSlaWatchdog(orderId: string): void {
  const timer = slaWatchdogs.get(orderId);
  if (timer) {
    clearTimeout(timer);
    slaWatchdogs.delete(orderId);
  }
}

// ─────────────────────────────────────────────────────────────
// Event Handlers
// ─────────────────────────────────────────────────────────────

/**
 * Handles an incoming negotiation.
 *
 * Fast-reject rule: Reject at negotiation stage (before payment) if
 * the input is invalid. This avoids a paid → undeliverable cycle
 * which locks escrow, forces a refund, and harms our reputation score.
 */
async function handleNegotiationCreated(
  e: { negotiation_id: string; requirements?: string; [key: string]: unknown },
  client: AgentClient
): Promise<void> {
  const negId = e.negotiation_id;
  log('INFO', `[Negotiation] Incoming: ${negId}`);

  // Parse requirements
  const params = e.requirements ? safeParseRequirements(e.requirements) : null;

  if (!params) {
    const reason = 'Invalid requirements: expected JSON with coin_symbol field.';
    log('WARN', `[Negotiation] Rejecting ${negId}: ${reason}`);
    try {
      await client.rejectNegotiation(negId, reason);
    } catch (err) {
      log('ERROR', `[Negotiation] Failed to reject ${negId}`, err);
    }
    return;
  }

  // Validate coin_symbol
  const validation = validateCoinSymbol(params.coin_symbol);
  if (!validation.valid) {
    const reason = `Invalid coin_symbol: ${validation.reason}`;
    log('WARN', `[Negotiation] Rejecting ${negId}: ${reason}`);
    try {
      await client.rejectNegotiation(negId, reason);
    } catch (err) {
      log('ERROR', `[Negotiation] Failed to reject ${negId}`, err);
    }
    return;
  }

  // Validated params
  const validatedParams: AnalysisParams = {
    coin_symbol: validation.symbol,
    contract_address: params.contract_address,
    chain_id: params.chain_id,
  };

  // Store in memory and Redis before accepting (so we have them when OrderPaid arrives)
  pendingNegotiations.set(negId, validatedParams);
  await persistNegotiationParams(negId, validatedParams);

  // Accept the negotiation
  try {
    const result = await client.acceptNegotiation(negId);
    const orderId = result?.orderId;
    log('INFO', `[Negotiation] Accepted ${negId} → orderId: ${orderId ?? 'pending on-chain'}`);

    // If the SDK returns the orderId immediately, pre-populate the order map.
    // On-chain order creation can take a moment, so it may arrive via OrderCreated event instead.
    if (orderId) {
      pendingOrders.set(orderId, validatedParams);
      await persistOrderParams(orderId, validatedParams);
    }
  } catch (err) {
    log('ERROR', `[Negotiation] acceptNegotiation failed for ${negId}`, err);
    // Clean up if accept failed
    pendingNegotiations.delete(negId);
  }
}

/**
 * Handles the OrderCreated event (on-chain order created after negotiation accept).
 * Used to map the newly-created orderId back to the negotiation params.
 */
async function handleOrderCreated(
  e: { order_id?: string; negotiation_id?: string; [key: string]: unknown },
  _client: AgentClient
): Promise<void> {
  const orderId = e.order_id;
  const negId = e.negotiation_id;
  if (!orderId) return;

  // Look up params from the negotiation we stored earlier
  const params = negId ? pendingNegotiations.get(negId) : null;
  if (params) {
    pendingOrders.set(orderId, params);
    await persistOrderParams(orderId, params);
    if (negId) pendingNegotiations.delete(negId);
    log('INFO', `[OrderCreated] Order ${orderId} mapped from neg ${negId} (${params.coin_symbol})`);
  } else {
    log('WARN', `[OrderCreated] No params found for order ${orderId} (neg: ${negId})`);
  }
}

/**
 * Handles the OrderPaid event — triggers the FUD analysis pipeline.
 *
 * Flow:
 * 1. Look up analysis params (memory → Redis → SDK API)
 * 2. Start SLA watchdog (fires at 480s if pipeline not done)
 * 3. Wait for a concurrency slot (queue — never reject a paid order)
 * 4. Execute the FUD analysis pipeline
 * 5. Cancel watchdog, deliver the 8-field schema result
 */
async function handleOrderPaid(
  e: { order_id?: string; [key: string]: unknown },
  client: AgentClient
): Promise<void> {
  const orderId = e.order_id;
  if (!orderId) {
    log('ERROR', '[OrderPaid] Event missing order_id — cannot process');
    return;
  }

  log('INFO', `[OrderPaid] Processing order ${orderId}`);

  // ── Step 1: Look up analysis params ────────────────────────
  const params = await lookupOrderParams(orderId, client);
  if (!params) {
    log('ERROR', `[OrderPaid] No params found for order ${orderId} — delivering degraded result`);
    // Deliver degraded rather than letting the order expire silently
    try {
      await client.deliverOrder(orderId, {
        type: DeliverableType.Schema,
        data: buildDegradedDeliverable('no_params_found') as Record<string, unknown>,
      });
      completedOrders.add(orderId);
    } catch (err) {
      log('ERROR', `[OrderPaid] Failed to deliver degraded result for ${orderId}`, err);
    }
    return;
  }

  const { coin_symbol, contract_address, chain_id } = params;
  log('INFO', `[OrderPaid] Will analyze: ${coin_symbol} (contract: ${contract_address ?? 'none'}, chain: ${chain_id ?? '1'})`);

  // ── Step 2: Start SLA watchdog ──────────────────────────────
  startSlaWatchdog(orderId, client);

  // ── Step 3: Wait for a concurrency slot ────────────────────
  // Paid orders cannot be dropped. We queue until a slot opens or
  // until the watchdog fires (which happens after 480s regardless).
  log('INFO', `[OrderPaid] Waiting for pipeline slot for order ${orderId}...`);
  const acquired = await waitForPipelineSlot(SLOT_WAIT_TIMEOUT_MS);

  if (!acquired) {
    log('WARN', `[OrderPaid] Could not acquire slot within ${SLOT_WAIT_TIMEOUT_MS / 1000}s for order ${orderId}. Watchdog will handle delivery.`);
    // The SLA watchdog will fire and deliver a degraded result. Nothing more to do here.
    return;
  }

  // Check if watchdog already fired while we were waiting for a slot
  if (completedOrders.has(orderId)) {
    log('INFO', `[OrderPaid] Order ${orderId} was already handled by SLA watchdog — releasing slot`);
    await releasePipelineSlot();
    return;
  }

  // ── Step 4: Run pipeline ────────────────────────────────────
  const pipelineStart = Date.now();
  log('INFO', `[OrderPaid] Pipeline starting for order ${orderId} (${coin_symbol})`);

  try {
    const verdict = await executeFudAnalysis(
      coin_symbol,
      contract_address,
      chain_id ?? '1'
    );

    const elapsed = Date.now() - pipelineStart;
    log('INFO', `[OrderPaid] Pipeline completed in ${elapsed}ms for order ${orderId}. Verdict: ${verdict.executable_verdict}`);

    // ── Step 5: Cancel watchdog + deliver ──────────────────────
    cancelSlaWatchdog(orderId);

    if (completedOrders.has(orderId)) {
      // Watchdog snuck in between the pipeline completing and this check
      log('WARN', `[OrderPaid] Order ${orderId} was already delivered by watchdog — skipping duplicate delivery`);
      return;
    }

    const deliverable = stripToDeliverableSchema(verdict);
    await client.deliverOrder(orderId, {
      type: DeliverableType.Schema,
      data: deliverable as Record<string, unknown>,
    });
    completedOrders.add(orderId);

    log('INFO', `[OrderPaid] ✓ Delivered order ${orderId} (${coin_symbol} → ${verdict.executable_verdict}, elapsed: ${elapsed}ms)`);

  } catch (pipelineError: unknown) {
    const elapsed = Date.now() - pipelineStart;
    const errMsg = pipelineError instanceof Error ? pipelineError.message : String(pipelineError);
    log('ERROR', `[OrderPaid] Pipeline FAILED for order ${orderId} after ${elapsed}ms: ${errMsg}`);

    // Only deliver degraded if watchdog hasn't already handled it
    cancelSlaWatchdog(orderId);
    if (!completedOrders.has(orderId)) {
      try {
        const degraded = buildDegradedDeliverable(`pipeline_error:${errMsg.slice(0, 100)}`);
        await client.deliverOrder(orderId, {
          type: DeliverableType.Schema,
          data: degraded as Record<string, unknown>,
        });
        completedOrders.add(orderId);
        log('INFO', `[OrderPaid] Degraded delivery submitted for failed order ${orderId}`);
      } catch (deliverErr) {
        log('ERROR', `[OrderPaid] Failed to deliver degraded result for ${orderId}`, deliverErr);
      }
    }
  } finally {
    await releasePipelineSlot();
    pendingOrders.delete(orderId);
    // Keep completedOrders entry for 30min to guard against duplicate events
    setTimeout(() => completedOrders.delete(orderId), 30 * 60 * 1000);
  }
}

// ─────────────────────────────────────────────────────────────
// Worker Startup
// ─────────────────────────────────────────────────────────────

async function main() {
  log('INFO', '═══════════════════════════════════════════════════');
  log('INFO', '   FUD.ai CROO CAP Provider Worker');
  log('INFO', '═══════════════════════════════════════════════════');

  // Validate env vars at startup — fail fast before WebSocket connects
  const requiredVars = ['CROO_API_URL', 'CROO_WS_URL', 'CROO_SDK_KEY'];
  const missing = requiredVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    log('ERROR', `Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  log('INFO', `CROO API: ${process.env.CROO_API_URL}`);
  log('INFO', `SLA: ${SLA_SECONDS}s | Watchdog fires at: ${SLA_WATCHDOG_SECONDS}s`);
  log('INFO', `Max concurrent pipelines: 5 (shared with HTTP route)`);

  const client = new AgentClient(
    {
      baseURL: process.env.CROO_API_URL!,
      wsURL: process.env.CROO_WS_URL!,
      // rpcURL is optional — defaults to Base mainnet if not set
      ...(process.env.BASE_RPC_URL ? { rpcURL: process.env.BASE_RPC_URL } : {}),
    },
    process.env.CROO_SDK_KEY!
  );

  log('INFO', 'Connecting to CROO WebSocket...');

  let stream: Awaited<ReturnType<typeof client.connectWebSocket>>;
  try {
    stream = await client.connectWebSocket();
  } catch (err) {
    log('ERROR', 'Failed to connect to CROO WebSocket:', err);
    process.exit(1);
  }

  log('INFO', '✓ Connected to CROO WebSocket. Listening for events...');

  // ── Event: NegotiationCreated ────────────────────────────────
  stream.on(EventType.NegotiationCreated, async (e) => {
    try {
      await handleNegotiationCreated(e as { negotiation_id: string; requirements?: string }, client);
    } catch (err) {
      log('ERROR', 'Unhandled error in NegotiationCreated handler', err);
    }
  });

  // ── Event: OrderCreated (maps orderId → negotiation params) ──
  stream.on(EventType.OrderCreated, async (e) => {
    try {
      await handleOrderCreated(e as { order_id?: string; negotiation_id?: string }, client);
    } catch (err) {
      log('ERROR', 'Unhandled error in OrderCreated handler', err);
    }
  });

  // ── Event: OrderPaid (triggers pipeline) ────────────────────
  stream.on(EventType.OrderPaid, async (e) => {
    try {
      await handleOrderPaid(e as { order_id?: string }, client);
    } catch (err) {
      log('ERROR', 'Unhandled error in OrderPaid handler', err);
    }
  });

  // ── Event: OrderExpired (cleanup) ───────────────────────────
  stream.on(EventType.OrderExpired, async (e) => {
    const orderId = (e as { order_id?: string }).order_id;
    if (orderId) {
      log('WARN', `[OrderExpired] Order ${orderId} expired — cancelling watchdog`);
      cancelSlaWatchdog(orderId);
      pendingOrders.delete(orderId);
    }
  });

  // ── Event: OrderRejected (cleanup) ──────────────────────────
  stream.on(EventType.OrderRejected, async (e) => {
    const orderId = (e as { order_id?: string }).order_id;
    if (orderId) {
      log('INFO', `[OrderRejected] Order ${orderId} was rejected — cancelling watchdog`);
      cancelSlaWatchdog(orderId);
      pendingOrders.delete(orderId);
    }
  });

  // ── All events (debug logging) ──────────────────────────────
  stream.onAny((e: { type?: string }) => {
    if (e?.type) {
      log('INFO', `[WS-Event] ${e.type}`);
    }
  });

  log('INFO', 'Worker is ready. Waiting for negotiations...');

  // ── Graceful Shutdown ────────────────────────────────────────
  const shutdown = (signal: string) => {
    log('INFO', `Received ${signal}. Shutting down gracefully...`);

    // Cancel all watchdog timers
    for (const [orderId, timer] of slaWatchdogs) {
      log('WARN', `Cancelling SLA watchdog for in-flight order ${orderId}`);
      clearTimeout(timer);
    }

    log('INFO', `Pending orders at shutdown: ${pendingOrders.size}`);
    log('INFO', 'Goodbye.');

    try {
      stream.close();
    } catch { /* ignore close errors */ }

    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Keep the process alive
  await new Promise(() => { /* intentionally never resolves */ });
}

main().catch(err => {
  console.error('[CROO-Worker][FATAL] Unhandled error in main():', err);
  process.exit(1);
});
