/**
 * In-memory sliding window rate limiter for login and password reset protection.
 */
interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitRecord>();

// Cleanup stale keys every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of memoryStore.entries()) {
      if (val.resetAt < now) {
        memoryStore.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref?.();
}

/**
 * Check and increment rate limit for a given key.
 * @param key unique identifier (e.g. `login:${ip}:${email}`)
 * @param maxAttempts maximum allowed attempts within window
 * @param windowMs time window in milliseconds (default 15 minutes)
 * @returns { allowed: boolean, remaining: number, resetInSeconds: number }
 */
export function rateLimit(
  key: string,
  maxAttempts: number = 6,
  windowMs: number = 15 * 60 * 1000
): { allowed: boolean; remaining: number; resetInSeconds: number } {
  const now = Date.now();
  const record = memoryStore.get(key);

  if (!record || record.resetAt < now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: maxAttempts - 1,
      resetInSeconds: Math.ceil(windowMs / 1000),
    };
  }

  if (record.count >= maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds: Math.ceil((record.resetAt - now) / 1000),
    };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: maxAttempts - record.count,
    resetInSeconds: Math.ceil((record.resetAt - now) / 1000),
  };
}

/**
 * Reset rate limit on successful authentication
 */
export function clearRateLimit(key: string): void {
  memoryStore.delete(key);
}
