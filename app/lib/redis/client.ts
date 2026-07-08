import { Redis } from '@upstash/redis';

// Lazy-initialized singleton Redis client.
// Prevents throwing at import/startup time when env vars are missing.
// Throws only when a Redis operation is actually invoked.
let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('[Redis] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in .env.local');
  }

  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return _redis;
}

export const redis = new Proxy({} as Redis, {
  get(_target, prop) {
    const r = getRedis();
    const value = (r as any)[prop];
    if (typeof value === 'function') {
      return value.bind(r);
    }
    return value;
  },
});

