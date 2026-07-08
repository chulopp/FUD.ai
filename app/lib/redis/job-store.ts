import { redis } from './client';
import type { VerdictResult } from '../mcts/pipeline';

// ─────────────────────────────────────────────────────────────
// Job State Types
// ─────────────────────────────────────────────────────────────

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface JobRecord {
  status: JobStatus;
  created_at: string;
  updated_at: string;
  coin_symbol: string;
  /** Full verdict payload — only present when status === 'completed' */
  payload?: VerdictResult;
  /** Error message — only present when status === 'failed' */
  error?: string;
}

// Job TTL in seconds: 10 minutes
const JOB_TTL_SECONDS = 600;

// Terminal statuses that cannot be regressed from.
const TERMINAL_STATUSES = new Set<JobStatus>(['completed', 'failed']);
const REGRESSING_STATUSES = new Set<JobStatus>(['running', 'pending']);

// ─────────────────────────────────────────────────────────────
// Redis key helper
// ─────────────────────────────────────────────────────────────

function jobKey(jobId: string): string {
  return `job:${jobId}`;
}

// ─────────────────────────────────────────────────────────────
// Create a new pending job
// ─────────────────────────────────────────────────────────────

export async function createJob(jobId: string, coinSymbol: string): Promise<void> {
  const record: JobRecord = {
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    coin_symbol: coinSymbol,
  };
  // Let the Upstash SDK handle serialization natively
  await redis.set(jobKey(jobId), record, { ex: JOB_TTL_SECONDS });
}

// ─────────────────────────────────────────────────────────────
// Update an existing job (partial patch)
// ─────────────────────────────────────────────────────────────

export async function updateJob(jobId: string, patch: Partial<JobRecord>): Promise<void> {
  const key = jobKey(jobId);
  const existing = await redis.get<JobRecord>(key);
  if (!existing) {
    console.warn(`[JobStore] updateJob: job ${jobId} not found in Redis — may have expired`);
    return;
  }

  // HIGH-10: Refuse to regress status from completed/failed back to running/pending
  if (
    TERMINAL_STATUSES.has(existing.status) &&
    patch.status &&
    REGRESSING_STATUSES.has(patch.status)
  ) {
    console.warn(
      `[JobStore] Refusing to regress job ${jobId} status from terminal "${existing.status}" to "${patch.status}"`
    );
    return;
  }

  const updated: JobRecord = {
    ...existing,
    ...patch,
    updated_at: new Date().toISOString(),
  };

  // Re-set with the original TTL. Let Upstash SDK serialize.
  await redis.set(key, updated, { ex: JOB_TTL_SECONDS });
}

// ─────────────────────────────────────────────────────────────
// Retrieve a job record
// ─────────────────────────────────────────────────────────────

export async function getJob(jobId: string): Promise<JobRecord | null> {
  try {
    return await redis.get<JobRecord>(jobKey(jobId));
  } catch (err) {
    console.error(`[JobStore] getJob: failed to retrieve or parse record for ${jobId}`, err);
    return null;
  }
}

