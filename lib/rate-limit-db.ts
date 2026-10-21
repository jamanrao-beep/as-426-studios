import { db } from "@/db/store";
import { rateLimit as memoryLimit } from "@/lib/rate-limit";

// A rate limiter that lives in the database, so every serverless instance shares one count.
// (The in-memory limiter is per instance, which on Vercel means it barely limits anything.)
let ready: Promise<void> | null = null;
function ensure() {
  ready ??= db()
    .prepare("CREATE TABLE IF NOT EXISTS rate_limits (rl_key VARCHAR(190) PRIMARY KEY NOT NULL, hits INT NOT NULL, reset_at BIGINT NOT NULL)")
    .run()
    .then(() => undefined)
    .catch((e) => {
      ready = null;
      throw e;
    });
  return ready;
}

export type Limit = { allowed: boolean; remaining: number; resetInSeconds: number };

// Counts one hit for `key`. The UPDATE only succeeds while hits < max, so two simultaneous requests can never both
// slip past the last slot. If the database is unreachable it falls back to the in-memory limiter rather than failing open.
export async function rateLimitDb(key: string, max: number, windowMs: number): Promise<Limit> {
  try {
    await ensure();
    const now = Date.now();
    const k = key.slice(0, 190);
    await db().prepare("DELETE FROM rate_limits WHERE rl_key = ? AND reset_at < ?").bind(k, now).run();
    await db().prepare("INSERT OR IGNORE INTO rate_limits (rl_key, hits, reset_at) VALUES (?, 0, ?)").bind(k, now + windowMs).run();
    const up = await db().prepare("UPDATE rate_limits SET hits = hits + 1 WHERE rl_key = ? AND hits < ?").bind(k, max).run();
    const row = await db().prepare("SELECT hits, reset_at FROM rate_limits WHERE rl_key = ?").bind(k).first<{ hits: number; reset_at: number }>();
    const resetInSeconds = Math.max(1, Math.ceil((Number(row?.reset_at || now) - now) / 1000));
    if (Math.random() < 0.01) db().prepare("DELETE FROM rate_limits WHERE reset_at < ?").bind(now).run().catch(() => {});
    if (!up.meta.changes) return { allowed: false, remaining: 0, resetInSeconds };
    return { allowed: true, remaining: Math.max(0, max - Number(row?.hits || 0)), resetInSeconds };
  } catch (e) {
    console.error("rateLimitDb fell back to memory:", e);
    return memoryLimit(key, max, windowMs);
  }
}

export async function clearRateLimitDb(key: string) {
  try {
    await ensure();
    await db().prepare("DELETE FROM rate_limits WHERE rl_key = ?").bind(key.slice(0, 190)).run();
  } catch {}
}

export const clientIp = (req: Request) => req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
