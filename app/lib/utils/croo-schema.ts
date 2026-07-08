import type { VerdictResult, EvidenceItem } from '../mcts/pipeline';

// ─────────────────────────────────────────────────────────────
// CROO Deliverable Schema — 8 fields
//
// This is the EXACT shape registered on the CROO Dashboard as
// the Service DeliverableType.Schema. Any mismatch will cause
// on-chain settlement to fail.
//
// Fields KEPT:   executable_verdict, drama_index, confidence,
//                dominant_branch, evidence_chain (as string[]),
//                coordination_signals, served_from_cache,
//                branch_probabilities
//
// Fields STRIPPED: status, fallback, reason, step_summary,
//                  market_cap_category, chatter_level (NOT in schema),
//                  risk_score (NOT in schema), pipeline_elapsed_ms
//
// NOTE: evidence_chain is converted from Array<{evidence,weight}>
//       to Array<string> per the registered schema.
// ─────────────────────────────────────────────────────────────

export interface CrooDeliverable {
  /** Action directive for the requester. */
  executable_verdict:
    | 'LIQUIDATE_LONGS'
    | 'HOLD'
    | 'ACCUMULATE'
    | 'IGNORE_FUD'
    | 'INSUFFICIENT_DATA';

  /** Composite intensity index (0–100). */
  drama_index: number;

  /** Pipeline confidence in the verdict (0.0–1.0, or null if degraded). */
  confidence: number | null;

  /** The dominant narrative branch from MCTS analysis. */
  dominant_branch: string;

  /**
   * Evidence supporting the verdict — simplified to plain strings
   * for on-chain schema compatibility. Each string is a human-readable
   * evidence statement (weight information is dropped).
   */
  evidence_chain: string[];

  /**
   * Sybil & coordination signals detected in social data.
   * Kept because it provides transparency to the requester about
   * whether the FUD is organic vs coordinated.
   */
  coordination_signals: {
    unique_author_ratio: number;
    duplicate_text_cluster_size: number;
    cross_platform_burst_window_minutes: number;
  } | Record<string, unknown>;

  /**
   * Whether this result was served from the pipeline's ingestion cache
   * (meaning it reuses a recent analysis rather than a fresh on-chain call).
   */
  served_from_cache: boolean;

  /**
   * Probability distribution across all narrative branches from MCTS.
   * e.g. { "organic_fud": 0.65, "coordinated_attack": 0.25, "neutral": 0.10 }
   */
  branch_probabilities: Record<string, number>;
}

/**
 * Strips a VerdictResult down to the 8 CROO deliverable schema fields.
 *
 * Converts evidence_chain from Array<{evidence, weight}> to Array<string>.
 * Uses empty fallbacks for any missing fields (ensures schema is always valid).
 */
export function stripToDeliverableSchema(verdict: VerdictResult): CrooDeliverable {
  // Convert structured evidence objects → plain strings
  const evidenceStrings: string[] = Array.isArray(verdict.evidence_chain)
    ? verdict.evidence_chain.map((item: EvidenceItem | string) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'evidence' in item) {
          return String(item.evidence);
        }
        return String(item);
      })
    : [];

  return {
    executable_verdict: verdict.executable_verdict,
    drama_index: verdict.drama_index,
    confidence: verdict.confidence,
    dominant_branch: verdict.dominant_branch ?? 'unknown',
    evidence_chain: evidenceStrings,
    coordination_signals: verdict.coordination_signals ?? {
      unique_author_ratio: 1.0,
      duplicate_text_cluster_size: 0,
      cross_platform_burst_window_minutes: 0,
    },
    served_from_cache: verdict.served_from_cache ?? false,
    branch_probabilities: verdict.branch_probabilities ?? {},
  };
}

/**
 * Builds a degraded deliverable for when the pipeline fails or the SLA
 * watchdog triggers. Delivers a well-formed schema with INSUFFICIENT_DATA
 * verdict so the requester receives a meaningful response rather than
 * an auto-refund with no explanation.
 */
export function buildDegradedDeliverable(reason: string): CrooDeliverable {
  return {
    executable_verdict: 'INSUFFICIENT_DATA',
    drama_index: 0,
    confidence: null,
    dominant_branch: `degraded:${reason}`,
    evidence_chain: [`Analysis could not complete: ${reason}`],
    coordination_signals: {
      unique_author_ratio: 1.0,
      duplicate_text_cluster_size: 0,
      cross_platform_burst_window_minutes: 0,
    },
    served_from_cache: false,
    branch_probabilities: {},
  };
}
