# Human Gate — World ID instead of CAPTCHA

A World App **mini-app** that replaces CAPTCHAs with **World ID proof of personhood**
to gate sensitive actions like login and checkout. Instead of asking "are you a
robot?", it asks World ID to prove a real, unique human is present — and your
server verifies that proof before letting the action through.

The demo flow is a checkout screen:

1. User taps **Verify you're human** → World ID modal (native bridge inside
   World App, QR on desktop).
2. The proof is verified **on your server** with World's Developer Portal.
3. The server issues a short-lived session token.
4. **Pay** calls a protected endpoint that trusts only that token.

## Why this is real verification, not a "CAPTCHA bypass"

The browser never gets to claim it's human. It only relays a zero-knowledge
proof. The security lives on the server:

- **`/api/verify` is the gate.** It calls `verifyCloudProof(...)` against World's
  Developer Portal. A forged or replayed client response can't pass it.
- **Single-use nonce.** `/api/nonce` issues a one-time value that is bound into
  the proof as its `signal`. It's spent the instant it's used, so a captured
  proof can't be replayed.
- **Short-lived, server-signed session.** Only after a valid proof does the
  server mint an HMAC-signed token (default 5 min), scoped to one action.
- **The sensitive endpoint does no World ID work.** `/api/checkout` only checks
  the server's own signature. Client claims are never trusted.

## Project layout

```
src/
  app/
    page.tsx              UI: checkout demo, IDKit widget, calls the API
    layout.tsx            Mobile-first shell
    api/
      nonce/route.ts      Issues a single-use nonce (replay protection)
      verify/route.ts     Server-side proof verification + session issue  ← the gate
      checkout/route.ts   Protected action; trusts only the session token
  components/
    minikit-provider.tsx  Installs MiniKit so it runs as a World App mini-app
  lib/
    session.ts            HMAC-signed session tokens (no extra deps)
    nonce-store.ts        Single-use nonce store (swap for Redis in prod)
```

## Setup

### 1. Install

```bash
npm install
```

If install fails on SDK versions, grab the latest:

```bash
npm i @worldcoin/idkit@latest @worldcoin/idkit-core@latest @worldcoin/minikit-js@latest
```

### 2. Configure World ID (Developer Portal)

Go to <https://developer.worldcoin.org>:

1. Create an **app** → copy its **App ID** (`app_...`).
2. Create an **Incognito Action** (e.g. `verify-human`).
3. **Important for recurring actions:** set the action's
   **Max verifications per person** to **0 (unlimited)**. Login and checkout
   are things the same human repeats, so you must *not* block repeat
   verifications. (Set it to 1 only for true one-time actions like a single
   airdrop claim.)

### 3. Environment

```bash
cp .env.local.example .env.local
```

Fill in `APP_ID` / `NEXT_PUBLIC_APP_ID`, `ACTION_ID` / `NEXT_PUBLIC_ACTION_ID`,
and a strong `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Run

```bash
npm run dev
```

Open <http://localhost:3000>. On desktop you'll get the QR flow; scan it with
World App. To test the true mini-app experience, register the app's URL in the
Developer Portal and open it from inside World App. Use the **World ID
Simulator** (<https://simulator.worldcoin.org>) with a `app_staging_...` ID for
local testing without an Orb.

## Choosing the verification level

`page.tsx` uses `VerificationLevel.Orb` — the strongest guarantee (a unique
human who has verified at an Orb). For a lower-friction, more CAPTCHA-like bar
that any World App user can pass, switch to `VerificationLevel.Device`:

```ts
verification_level={VerificationLevel.Device}
```

Orb gives you Sybil resistance (one unique human); Device only attests a unique
device. Pick based on how much fraud resistance the action needs.

## Taking it to production

- **Nonce store:** replace the in-memory `Map` in `lib/nonce-store.ts` with
  Redis (`SET nonce EX 300`, then `GETDEL` to consume) or a DB row with a
  unique constraint, so it works across multiple server instances.
- **Sessions:** the HMAC token in `lib/session.ts` is intentionally minimal and
  dependency-free. Swap for your existing auth/JWT system if you have one — keep
  the rule that the gated route verifies server-side.
- **Per-human limits:** `nullifier_hash` is stable per person per action. Use it
  for rate limiting or fraud scoring (don't store it as PII; it's an anonymous
  pseudonym).
- **Bind the signal to the transaction:** for checkout you can make the nonce
  encode the cart/amount server-side so a proof can't be moved to a different
  order.

## How the pieces map to the SDKs

- `@worldcoin/minikit-js` — makes it a World App mini-app (`MiniKit.install()`).
- `@worldcoin/idkit` — the verification widget (`IDKitWidget`), unified so the
  same code works in-app and on desktop.
- `@worldcoin/idkit-core` — `verifyCloudProof`, the server-side check.
