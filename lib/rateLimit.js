// Per-IP rate limiter with unlock-token bypass.
//
// Free tier: 3 requests / 24h per IP across all AI endpoints.
// Unlocked users (X-Unlock-Token header matching UNLOCK_CODES) — no limit.
//
// Storage: in-memory Map. Resets on server restart; acceptable for launch.
// Swap to Redis once we feel traffic.

const WINDOW_MS = 24 * 60 * 60 * 1000;
const FREE_LIMIT = parseInt(process.env.AI_FREE_LIMIT) || 3;

const buckets = new Map(); // ip -> { count, resetAt }

const UNLOCK_CODES = (process.env.UNLOCK_CODES || "SILICON-PRO,UNLOCK-ALL")
  .split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);

function isUnlocked(token) {
  if (!token) return false;
  try {
    return UNLOCK_CODES.includes(
      Buffer.from(String(token), "base64").toString("utf8").toUpperCase()
    );
  } catch { return false; }
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return String(fwd).split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

export function aiRateLimit(req, res, next) {
  // Unlocked? pass through.
  const token = req.headers["x-unlock-token"] || req.body?.unlock || req.query?.u;
  if (isUnlocked(token)) {
    res.setHeader("X-RateLimit-Unlocked", "1");
    return next();
  }

  const ip = clientIp(req);
  const now = Date.now();
  let bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(ip, bucket);
  }

  if (bucket.count >= FREE_LIMIT) {
    res.setHeader("X-RateLimit-Limit", FREE_LIMIT);
    res.setHeader("X-RateLimit-Remaining", 0);
    res.setHeader("X-RateLimit-Reset", Math.floor(bucket.resetAt / 1000));
    return res.status(429).json({
      error: "Free tier limit reached",
      message: `You've used ${FREE_LIMIT} free AI requests. Resets in ${Math.ceil((bucket.resetAt - now) / 3600000)}h. Unlock for unlimited.`,
      resetAt: bucket.resetAt,
      unlock: true
    });
  }

  bucket.count++;
  res.setHeader("X-RateLimit-Limit", FREE_LIMIT);
  res.setHeader("X-RateLimit-Remaining", FREE_LIMIT - bucket.count);
  res.setHeader("X-RateLimit-Reset", Math.floor(bucket.resetAt / 1000));
  next();
}

// Periodic cleanup so the Map doesn't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(ip);
  }
}, 60 * 60 * 1000).unref();
