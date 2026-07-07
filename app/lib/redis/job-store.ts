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
  // SET with EX (expire in 10 min)
  await redis.set(jobKey(jobId), JSON.stringify(record), { ex: JOB_TTL_SECONDS });
}

// ─────────────────────────────────────────────────────────────
// Update an existing job (partial patch)
// ─────────────────────────────────────────────────────────────

export async function updateJob(jobId: string, patch: Partial<JobRecord>): Promise<void> {
  const key = jobKey(jobId);
  const raw = await redis.get<string>(key);
  if (!raw) {
    console.warn(`[JobStore] updateJob: job ${jobId} not found in Redis — may have expired`);
    return;
  }
  const existing: JobRecord = typeof raw === 'string' ? JSON.parse(raw) : raw as unknown as JobRecord;
  const updated: JobRecord = {
    ...existing,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  // Re-set with the original TTL. We use EX = JOB_TTL_SECONDS from creation
  // time — keeping a fixed absolute expiry is simpler than tracking remaining TTL.
  await redis.set(key, JSON.stringify(updated), { ex: JOB_TTL_SECONDS });
}

// ─────────────────────────────────────────────────────────────
// Retrieve a job record
// ─────────────────────────────────────────────────────────────

export async function getJob(jobId: string): Promise<JobRecord | null> {
  const raw = await redis.get<string>(jobKey(jobId));
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw as unknown as JobRecord;
  } catch {
    console.error(`[JobStore] getJob: failed to parse record for ${jobId}`);
    return null;
  }
}
