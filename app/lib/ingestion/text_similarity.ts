/**
 * text_similarity.ts — shared Jaccard clustering utilities.
 *
 * Fixes CRITICAL-05: the identical O(n²) Jaccard + BFS clustering code that
 * lived in BOTH sybil_detector.ts AND causality.ts is consolidated here.
 * Both modules now import from this file, eliminating the duplication and
 * ensuring the 100-post cap and stack-safe min/max are applied consistently.
 *
 * Performance contract:
 *   - Input is capped at MAX_POSTS_FOR_CLUSTERING (100) before any nested loop.
 *   - 100 posts → max 4,950 Jaccard comparisons → < 5 ms on any modern CPU.
 *   - min/max over timestamps uses Array.reduce() instead of Math.min(...spread)
 *     to avoid a potential RangeError on very large arrays (MEDIUM-06 fix).
 */

export interface ClusterablePost {
  text: string;
  timestamp?: number;
}

/** Hard cap: posts beyond this index are discarded before O(n²) loop. */
export const MAX_POSTS_FOR_CLUSTERING = 100;

// ─────────────────────────────────────────────────────────────
// Core primitives
// ─────────────────────────────────────────────────────────────

/**
 * Extracts character 3-grams from text for Jaccard similarity comparison.
 */
export function get3Grams(text: string): Set<string> {
  const grams = new Set<string>();
  const cleanText = text.toLowerCase().replace(/\s+/g, ' ').trim();
  if (cleanText.length < 3) {
    if (cleanText.length > 0) {
      grams.add(cleanText);
    }
    return grams;
  }
  for (let i = 0; i < cleanText.length - 2; i++) {
    grams.add(cleanText.substring(i, i + 3));
  }
  return grams;
}

/**
 * Calculates Jaccard similarity between two 3-gram sets.
 * Returns a value in [0, 1] — 1.0 means identical, 0.0 means no shared grams.
 */
export function calculateJaccard(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersectionSize = 0;
  for (const elem of setA) {
    if (setB.has(elem)) {
      intersectionSize++;
    }
  }
  const unionSize = setA.size + setB.size - intersectionSize;
  if (unionSize === 0) return 0;
  return intersectionSize / unionSize;
}

// ─────────────────────────────────────────────────────────────
// Cluster detection
// ─────────────────────────────────────────────────────────────

export interface ClusterResult {
  /** Indices (into the capped input array) belonging to the largest cluster. */
  indices: number[];
  /** Size of the largest cluster (0 if no duplicates found). */
  clusterSize: number;
}

/**
 * Finds the largest cluster of near-duplicate posts via pairwise Jaccard
 * similarity and BFS-based connected-component detection.
 *
 * @param posts               Array of posts with text (and optionally timestamp).
 * @param options.maxPosts    Cap applied before any O(n²) work. Default 100.
 * @param options.threshold   Jaccard similarity threshold. Default 0.70.
 * @returns ClusterResult with indices and clusterSize.
 */
export function findLargestCluster(
  posts: ClusterablePost[],
  options: { maxPosts?: number; threshold?: number } = {}
): ClusterResult {
  const maxPosts = options.maxPosts ?? MAX_POSTS_FOR_CLUSTERING;
  const threshold = options.threshold ?? 0.70;

  if (posts.length === 0) return { indices: [], clusterSize: 0 };

  // Apply hard cap — keep most-recent posts (highest timestamp) when possible.
  let capped = posts;
  if (posts.length > maxPosts) {
    const sorted = [...posts].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
    capped = sorted.slice(0, maxPosts);
  }

  const n = capped.length;
  const postGrams = capped.map(p => get3Grams(p.text));
  const adj: number[][] = Array.from({ length: n }, () => []);

  // Build adjacency list
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = calculateJaccard(postGrams[i], postGrams[j]);
      if (sim > threshold) {
        adj[i].push(j);
        adj[j].push(i);
      }
    }
  }

  // BFS connected components
  const visited = new Uint8Array(n);
  let largestComponent: number[] = [];

  for (let i = 0; i < n; i++) {
    if (visited[i] === 0) {
      const comp: number[] = [];
      const queue: number[] = [i];
      visited[i] = 1;

      while (queue.length > 0) {
        const curr = queue.shift()!;
        comp.push(curr);
        for (const neighbor of adj[curr]) {
          if (visited[neighbor] === 0) {
            visited[neighbor] = 1;
            queue.push(neighbor);
          }
        }
      }

      if (comp.length > largestComponent.length) {
        largestComponent = comp;
      }
    }
  }

  return {
    indices: largestComponent,
    clusterSize: largestComponent.length,
  };
}

// ─────────────────────────────────────────────────────────────
// Burst window calculation
// ─────────────────────────────────────────────────────────────

/**
 * Calculates the time window (in minutes) spanned by the given timestamps.
 * Uses Array.reduce() instead of Math.min/max spread to avoid stack overflow
 * on large arrays (MEDIUM-06 fix).
 *
 * @returns Window in minutes, or 0 if fewer than 2 valid timestamps.
 */
export function calculateBurstWindowMinutes(timestamps: number[]): number {
  const valid = timestamps.filter(t => typeof t === 'number' && !isNaN(t));
  if (valid.length < 2) return 0;

  const minTs = valid.reduce((a, b) => (b < a ? b : a), valid[0]);
  const maxTs = valid.reduce((a, b) => (b > a ? b : a), valid[0]);
  return (maxTs - minTs) / 60_000;
}
