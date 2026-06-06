// LemonSqueezy — subscription payments adapter.
// Docs: https://docs.lemonsqueezy.com/api

import { createHmac } from "node:crypto";

const BASE = "https://api.lemonsqueezy.com/v1";

export function lemonEnabled() {
  return !!process.env.LEMON_API_KEY;
}

function apiHeaders() {
  return {
    Authorization: `Bearer ${process.env.LEMON_API_KEY}`,
    Accept: "application/vnd.api+json",
    "Content-Type": "application/vnd.api+json"
  };
}

// Map variant ID → plan name
export function planFromVariant(variantId) {
  const id = String(variantId);
  if (id === String(process.env.LEMON_VARIANT_CREATOR)) return "creator";
  if (id === String(process.env.LEMON_VARIANT_PRO)) return "pro";
  return null;
}

// Get first store ID (cached)
let _storeId = null;
async function storeId() {
  if (_storeId) return _storeId;
  const res = await fetch(`${BASE}/stores`, { headers: apiHeaders() });
  const json = await res.json();
  _storeId = json.data?.[0]?.id;
  return _storeId;
}

// Create a hosted checkout URL for a variant.
export async function createCheckout(variantId, { successUrl, cancelUrl } = {}) {
  const sid = await storeId();
  const body = JSON.stringify({
    data: {
      type: "checkouts",
      attributes: {
        product_options: { redirect_url: successUrl || "" },
        checkout_options: { button_color: "#7c3aed" }
      },
      relationships: {
        store:   { data: { type: "stores",   id: String(sid) } },
        variant: { data: { type: "variants", id: String(variantId) } }
      }
    }
  });
  const res = await fetch(`${BASE}/checkouts`, { method: "POST", headers: apiHeaders(), body });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Lemon checkout ${res.status}: ${t}`);
  }
  const json = await res.json();
  return { checkoutUrl: json.data.attributes.url };
}

// Find active subscription by customer email (scans all active subs).
// Returns { plan, subscriptionId, customerId, variantId } or null.
export async function findSubscriptionByEmail(email) {
  const lower = email.toLowerCase().trim();
  let page = 1;
  while (true) {
    const res = await fetch(`${BASE}/subscriptions?filter[status]=active&page[size]=100&page[number]=${page}`, {
      headers: apiHeaders()
    });
    const json = await res.json();
    const items = json.data || [];
    const found = items.find(s => s.attributes.user_email?.toLowerCase() === lower);
    if (found) {
      return {
        plan: planFromVariant(found.attributes.variant_id),
        subscriptionId: found.id,
        customerId: found.attributes.customer_id,
        variantId: found.attributes.variant_id
      };
    }
    if (!json.meta?.page?.lastPage || page >= json.meta.page.lastPage) break;
    page++;
  }
  return null;
}

// --- Signed access token (no DB needed) ---
// Format: base64url( plan:customerId:expiresMs:hmac24 )

function tokenSecret() { return process.env.TOKEN_SECRET || "dev-token-secret-change-me"; }

export function createToken(plan, customerId, ttlDays = 35) {
  const expires = String(Date.now() + ttlDays * 86400 * 1000);
  const payload = `${plan}:${customerId}:${expires}`;
  const sig = createHmac("sha256", tokenSecret()).update(payload).digest("hex").slice(0, 24);
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

// Returns { plan, customerId } or null
export function verifyToken(token) {
  try {
    const raw = Buffer.from(String(token), "base64url").toString();
    const parts = raw.split(":");
    if (parts.length !== 4) return null;
    const [plan, customerId, expires, sig] = parts;
    const payload = `${plan}:${customerId}:${expires}`;
    const expected = createHmac("sha256", tokenSecret()).update(payload).digest("hex").slice(0, 24);
    if (sig !== expected) return null;
    if (Date.now() > Number(expires)) return null;
    return { plan, customerId };
  } catch { return null; }
}

// Verify webhook X-Signature header
export function verifyWebhookSig(rawBody, signature) {
  const secret = process.env.LEMON_WEBHOOK_SECRET || "";
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return expected === signature;
}
