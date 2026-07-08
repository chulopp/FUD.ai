/**
 * sybil_detector.ts — Coordination & Sybil detection metrics from social posts.
 *
 * CRITICAL-05 fix: duplicated Jaccard/BFS code removed. All clustering logic
 * now lives in text_similarity.ts (shared with causality.ts), eliminating the
 * double-computation that was running O(n²) Jaccard twice per request.
 * A 100-post cap is enforced inside findLargestCluster().
 */

import { findLargestCluster, calculateBurstWindowMinutes } from './text_similarity';

export interface SocialPost {
  username?: string;
  channel?: string;
  text: string;
  likes?: number;
  retweets?: number;
  views?: string | null;
  createdAt?: string | null;
  author_id?: string;
  timestamp?: number;
}

export interface CoordinationSignals {
  unique_author_ratio: number;
  duplicate_text_cluster_size: number;
  cross_platform_burst_window_minutes: number;
}

/**
 * Computes coordination and Sybil detection metrics from raw social posts.
 * Pure heuristics based on unique authors, duplication Jaccard clustering, and time bursts.
 */
export function computeCoordinationSignals(posts: SocialPost[]): CoordinationSignals {
  if (posts.length === 0) {
    return {
      unique_author_ratio: 1.0,
      duplicate_text_cluster_size: 0,
      cross_platform_burst_window_minutes: 0,
    };
  }

  // 1. Unique author ratio
  // Extract all author_ids (fallback to channel or username or positional sentinel if missing)
  const authors = posts.map((p, idx) => p.author_id || p.username || p.channel || `unknown_${idx}`);
  const uniqueAuthors = new Set(authors);
  // Defensive guard: posts.length is guaranteed > 0 here (checked above)
  const unique_author_ratio = uniqueAuthors.size / (posts.length || 1);

  // 2. Find largest near-duplicate cluster using shared module (100-post cap enforced inside)
  const { indices: largestComponent, clusterSize } = findLargestCluster(posts);

  // 3. Calculate cross-platform burst window for the largest cluster (in minutes)
  let cross_platform_burst_window_minutes = 0;
  if (largestComponent.length > 1) {
    const timestamps = largestComponent
      .map(idx => posts[idx].timestamp)
      .filter((t): t is number => typeof t === 'number' && !isNaN(t));

    cross_platform_burst_window_minutes = calculateBurstWindowMinutes(timestamps);
  }

  return {
    unique_author_ratio,
    duplicate_text_cluster_size: clusterSize,
    cross_platform_burst_window_minutes,
  };
}
