/**
 * Single-use nonce store (replay protection).
 *
 * Before a user verifies, the server hands out a one-time nonce. That same
 * nonce is fed into the World ID proof as the `signal`, so the proof is
 * cryptographically bound to *this* attempt. When the proof comes back, we
 * spend the nonce. A captured proof cannot be replayed because:
 *   1. its signal must match a nonce we issued, and
 *   2. that nonce is deleted the moment it is used.
 *
 * This in-memory Map is fine for local dev and a single server process.
 * For production / multiple instances, swap the body of these functions for
 * Redis (SET nonce EX 300, then GETDEL on consume) or a DB row with a unique
 * constraint. The interface stays the same.
 */

import crypto from "crypto";

interface NonceRecord {
  expiresAt: number; // Unix ms
}

const store = new Map<string, NonceRecord>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes

function sweep() {
  const now = Date.now();
  for (const [nonce, rec] of store) {
    if (rec.expiresAt < now) store.delete(nonce);
  }
}

/** Issue a fresh single-use nonce. */
export function issueNonce(): string {
  sweep();
  const nonce = crypto.randomUUID().replace(/-/g, "");
  store.set(nonce, { expiresAt: Date.now() + TTL_MS });
  return nonce;
}

/**
 * Consume a nonce. Returns true exactly once per valid nonce, then false
 * forever after. Returns false for unknown or expired nonces.
 */
export function consumeNonce(nonce: string | undefined | null): boolean {
  if (!nonce) return false;
  const rec = store.get(nonce);
  if (!rec) return false;
  store.delete(nonce); // single use: gone whether or not it was expired
  if (rec.expiresAt < Date.now()) return false;
  return true;
}
