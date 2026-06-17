"use client";

import { useCallback, useEffect, useState } from "react";
import {
  IDKitWidget,
  VerificationLevel,
  type ISuccessResult,
} from "@worldcoin/idkit";

const APP_ID = process.env.NEXT_PUBLIC_APP_ID as `app_${string}`;
const ACTION = process.env.NEXT_PUBLIC_ACTION_ID as string;

type Step = "loading" | "ready" | "verified" | "done";

export default function Page() {
  const [step, setStep] = useState<Step>("loading");
  const [nonce, setNonce] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Pull a fresh single-use nonce. This binds the next proof to this attempt.
  const refreshNonce = useCallback(async () => {
    try {
      const res = await fetch("/api/nonce");
      const data = await res.json();
      setNonce(data.nonce);
      setStep((s) => (s === "loading" ? "ready" : s));
    } catch {
      setError("Couldn't reach the server. Is the dev server running?");
    }
  }, []);

  useEffect(() => {
    refreshNonce();
  }, [refreshNonce]);

  // Runs inside IDKit's modal. Throwing here makes IDKit show the error.
  const handleVerify = useCallback(
    async (proof: ISuccessResult) => {
      setError(null);
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proof, nonce }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Verification failed.");
      }
      setToken(data.token);
    },
    [nonce]
  );

  // Fires after handleVerify resolves successfully.
  const onSuccess = useCallback(() => {
    setStep("verified");
  }, []);

  // The gated sensitive action. Sends only the server-signed session.
  const completeCheckout = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Checkout failed.");
      }
      setResult(data.message);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed.");
    } finally {
      setBusy(false);
    }
  }, [token]);

  const reset = useCallback(() => {
    setToken(null);
    setResult(null);
    setError(null);
    setStep("ready");
    refreshNonce();
  }, [refreshNonce]);

  const configured =
    APP_ID && ACTION && !APP_ID.includes("replace_me");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--muted)]">
          Human Gate
        </span>
        <h1 className="text-2xl font-semibold leading-tight">
          Confirm checkout
        </h1>
        <p className="text-sm text-[var(--muted)]">
          No CAPTCHA. One tap proves a real, unique person is here.
        </p>
      </header>

      {/* Order summary */}
      <section className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--muted)]">Order #4815</span>
          <span className="text-[var(--muted)]">Qty 1</span>
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <span className="font-medium">Annual membership</span>
          <span className="text-lg font-semibold">$49.00</span>
        </div>
      </section>

      {!configured && (
        <div className="rounded-xl border border-[var(--warn)]/40 bg-[var(--warn)]/10 px-4 py-3 text-sm text-[var(--warn)]">
          Set <code>NEXT_PUBLIC_APP_ID</code> and{" "}
          <code>NEXT_PUBLIC_ACTION_ID</code> in <code>.env.local</code> and
          restart the dev server. See the README.
        </div>
      )}

      {/* Step 1: verify */}
      {(step === "loading" || step === "ready") && (
        <IDKitWidget
          app_id={APP_ID}
          action={ACTION}
          signal={nonce ?? undefined}
          verification_level={VerificationLevel.Orb}
          handleVerify={handleVerify}
          onSuccess={onSuccess}
        >
          {({ open }) => (
            <button
              onClick={open}
              disabled={!nonce || !configured}
              className="w-full rounded-2xl bg-[var(--accent)] px-5 py-4 text-base font-semibold text-white transition active:bg-[var(--accent-press)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              {step === "loading" ? "Preparing…" : "Verify you're human"}
            </button>
          )}
        </IDKitWidget>
      )}

      {/* Step 2: gated action, unlocked */}
      {step === "verified" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm text-[var(--ok)]">
            <span aria-hidden>✓</span> Verified human — session active
          </div>
          <button
            onClick={completeCheckout}
            disabled={busy}
            className="w-full rounded-2xl bg-[var(--ok)] px-5 py-4 text-base font-semibold text-[#06281b] transition active:opacity-90 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ok)]"
          >
            {busy ? "Processing…" : "Pay $49.00"}
          </button>
        </div>
      )}

      {/* Step 3: done */}
      {step === "done" && (
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-[var(--ok)]/40 bg-[var(--ok)]/10 p-5 text-sm text-[var(--ink)]">
            {result}
          </div>
          <button
            onClick={reset}
            className="w-full rounded-2xl border border-[var(--line)] px-5 py-4 text-base font-medium text-[var(--ink)] transition active:bg-[var(--panel)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Run it again
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <footer className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
        The button only relays a zero-knowledge proof. Your server verifies it
        with World and issues the session — the browser never decides who's
        human.
      </footer>
    </div>
  );
}
