import { NextRequest, NextResponse } from "next/server";
import { verifyCloudProof } from "@worldcoin/idkit-core/backend";
import { type ISuccessResult } from "@worldcoin/idkit-core";
import { consumeNonce } from "@/lib/nonce-store";
import { issueSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const APP_ID = process.env.APP_ID as `app_${string}`;
const ACTION_ID = process.env.ACTION_ID as string;

/**
 * POST /api/verify
 * Body: { proof: ISuccessResult, nonce: string }
 *
 * This is the one step that must run on the server. The browser only relays a
 * zero-knowledge proof; it is World's Developer Portal that confirms the proof
 * is real and was produced by a verified human. We never trust the client.
 */
export async function POST(req: NextRequest) {
  if (!APP_ID || !ACTION_ID) {
    return NextResponse.json(
      { ok: false, error: "Server is missing APP_ID / ACTION_ID. Check .env.local." },
      { status: 500 }
    );
  }

  let body: { proof?: ISuccessResult; nonce?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const { proof, nonce } = body;
  if (!proof || !nonce) {
    return NextResponse.json(
      { ok: false, error: "Missing proof or nonce." },
      { status: 400 }
    );
  }

  // 1) Replay protection: the nonce must be one we issued and have not spent.
  //    It is also the `signal` the proof was bound to, so spending it here
  //    closes the replay window before we even talk to World.
  if (!consumeNonce(nonce)) {
    return NextResponse.json(
      { ok: false, error: "Nonce is unknown, expired, or already used." },
      { status: 401 }
    );
  }

  // 2) Verify the proof with World. The `signal` (4th arg) must equal what the
  //    client passed to the widget — here, the nonce. If they don't match,
  //    verification fails, which is exactly what we want.
  const result = await verifyCloudProof(proof, APP_ID, ACTION_ID, nonce);

  if (!result.success) {
    // result also carries `code` / `detail` from the portal for debugging.
    return NextResponse.json(
      { ok: false, error: "Proof verification failed.", detail: result },
      { status: 401 }
    );
  }

  // 3) Verified human. Mint a short-lived, server-signed session bound to this
  //    action. `nullifier_hash` is the same value every time a given person
  //    verifies this action — useful for rate-limiting or fraud signals, but we
  //    do NOT reject repeats (login/checkout are meant to recur).
  const token = issueSession({
    nullifierHash: proof.nullifier_hash,
    action: ACTION_ID,
    ttlSeconds: 300,
  });

  return NextResponse.json({ ok: true, token });
}
