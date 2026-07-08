"use client";

export function getDemoFingerprint(): string {
  if (typeof window === "undefined") return "ssr";
  const raw = [
    navigator.userAgent,
    `${screen.width}x${screen.height}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.language,
  ].join("|");
  return raw;
}

const KEY = "fud_demo_usage";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface UsageRecord {
  count: number;
  windowStart: number;
}

export function getDemoUsage(): UsageRecord {
  if (typeof window === "undefined") return { count: 0, windowStart: 0 };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { count: 0, windowStart: Date.now() };
    const parsed: UsageRecord = JSON.parse(raw);
    if (Date.now() - parsed.windowStart > WEEK_MS) {
      return { count: 0, windowStart: Date.now() };
    }
    return parsed;
  } catch {
    return { count: 0, windowStart: Date.now() };
  }
}

export function incrementDemoUsage(): UsageRecord {
  const current = getDemoUsage();
  const updated: UsageRecord = {
    count: current.count + 1,
    windowStart: current.windowStart || Date.now(),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
  return updated;
}

export const DEMO_WEEKLY_LIMIT = 2;
