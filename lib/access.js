// Shared access/unlock logic — single source of truth for both the HTTP
// routes (server.js) and the rate limiter (rateLimit.js).

import { verifyToken } from "./lemon.js";

export const UNLOCK_CODES = (process.env.UNLOCK_CODES || "SILICON-PRO,UNLOCK-ALL")
  .split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);

// A request is "unlocked" if it presents a legacy unlock code (base64) or a
// valid signed LemonSqueezy token.
export function isUnlocked(token) {
  if (!token) return false;
  try {
    if (UNLOCK_CODES.includes(Buffer.from(String(token), "base64").toString("utf8").toUpperCase())) return true;
  } catch { /* not base64 — ignore */ }
  return !!verifyToken(String(token));
}
