import crypto from "crypto";

/**
 * A tiny, self-contained signed-token implementation (HMAC-SHA256).
 *
 * Why not just trust the client when it says "I'm verified"?
 * Because anyone can send `{ verified: true }`. The whole point of this app
 * is that the *server* decides who is human. So after we verify a World ID
 * proof, we mint a token here that the server itself signed. The gated
 * endpoint re-checks the signature before doing anything sensitive. A client
 * cannot forge this token without SESSION_SECRET.
 *
 * In production you may prefer a battle-tested JWT library, but the security
 * properties are identical and visible here: payload + expiry + HMAC.
 */

const SECRET = process.env.SESSION_SECRET ?? "";

if (!SECRET || SECRET.length < 32) {
  // Fail loud in dev rather than silently shipping a weak secret.
  console.warn(
    "[session] SESSION_SECRET is missing or too short. Set a 64-char random hex string in .env.local."
  );
}

export interface HumanSession {
  /** Unique-per-person identifier from World ID. Same human => same value for this action. */
  nullifierHash: string;
  /** The action this proof was for. The gated route checks it matches. */
  action: string;
  /** Unix seconds. */
  iat: number;
  /** Unix seconds. Short-lived on purpose. */
  exp: number;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sign(data: string): string {
  return b64url(crypto.createHmac("sha256", SECRET).update(data).digest());
}

/** Create a short-lived signed session for a verified human. */
export function issueSession(
  params: { nullifierHash: string; action: string; ttlSeconds?: number }
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: HumanSession = {
    nullifierHash: params.nullifierHash,
    action: params.action,
    iat: now,
    exp: now + (params.ttlSeconds ?? 300), // default 5 minutes
  };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

/** Verify a session token. Returns the payload, or null if invalid/expired/tampered. */
export function readSession(token: string | undefined | null): HumanSession | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;

  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = sign(body);
  // Constant-time comparison to avoid timing leaks.
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }

  let payload: HumanSession;
  try {
    payload = JSON.parse(Buffer.from(body, "base64").toString("utf8"));
  } catch {
    return null;
  }

  if (Math.floor(Date.now() / 1000) > payload.exp) return null;
  return payload;
}
