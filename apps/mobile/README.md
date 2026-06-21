# mobile — Krishi-Verse app (one account, role-switching)

Expo SDK 51 + **expo-router** (file-based routing under `src/app`). Offline-first, vernacular (hi/en/gu),
built for budget Android in low-signal villages. Built on the shared `@krishi-verse/sdk-js` (resilient typed API
client), `@krishi-verse/i18n` (formatters + translator), and `@krishi-verse/ui-native` (the RN component library
on the Phase-1 design tokens). Target: small APK, usable on 2 GB-RAM phones, works on 2G.

## What's built this release (the foundation + the farmer vertical)

**Shared RN component library — `packages/ui-native`** (was stubs): `theme` (the full Phase-1 token set), `Button`,
`Card`, `Input`, `OtpInput`, `MoneyText` (bigint-minor → ₹, Law 2), `StatusPill`, `EmptyState`, `SkeletonCard`,
`ScreenScaffold`, `VoiceButton`. All ≥48px touch targets, accessibility props, tokens-only (no hardcoded values).

**App core — `src/core`:**
- `config.ts` — single env reader; **fails closed** if the API origin is missing.
- `api/client.ts` — SDK client factory; live in-memory bearer (registered by the auth store) + tenant header;
  `anonClient()` for the pre-auth OTP flow.
- `api/offline-queue.ts` — durable, **framework-free** write queue: dedupe by idempotency key (Law 3), sequential
  replay, transient-retry with attempt cap, permanent-fail dead-lettering. Storage injected (`offline/kv.ts`
  wires AsyncStorage). **Unit-tested.**
- `auth/session.reducer.ts` — **pure** session state machine (boot/sign-in/refresh/role/language/sign-out +
  refresh-skew). **Unit-tested.**
- `auth/token-store.ts` — tokens in **expo-secure-store** (Keychain/Keystore), never AsyncStorage or logs (Law 4).
- `auth/auth.store.tsx` — React provider: boot-restore + proactive refresh (fail-closed sign-out), `useAuth()`.
- `auth/otp.helpers.ts` — E.164 normalization + resend cooldown (pure, **unit-tested**); `otp.flow.ts` wires the SDK.
- `auth/role-switcher.ts` — multi-role catalog + home routing (**unit-tested**).
- `i18n/` — runtime over `@krishi-verse/i18n` with bundled hi/en/gu catalogs + `useTranslation()` hook + numerals
  (lakh/crore, Devanagari/Gujarati digit transliteration — **unit-tested**).

**Onboarding/auth flow (design screens 01–05):** `welcome → language → phone → verify (OTP, resend cooldown,
enumeration-safe, attempt-aware) → role → profile`, wired to the real `auth/otp` endpoints; tokens stored
encrypted.

**Farmer vertical (design screens 09–12) + bottom tabs:** `home` (greeting, Speak-to-Sell, My-Listings + Wallet
tiles, mandi pulse [hidden on failure — never faked], pull-to-refresh), `listings` (my listings, keyset, empty
state, FAB), `listings/new` (catalogue product picker → qty + ₹→paise via BigInt, **offline-first create** with
idempotency key), `listings/[id]`, plus `orders`, `wallet`, `profile` (language switch + sign out).

## Security / correctness (per the build guide)

- **Money is bigint minor units, never float** (Law 2) — `MoneyText` + `formatMoneyMinor`; the create form does
  `BigInt(rupees) * 100n`.
- **Tokens encrypted at rest** (SecureStore), unreadable to JS; never logged. The API re-enforces RBAC + tenant
  scope on every call — the client role only drives navigation.
- **Idempotency on every mutation** (Law 3); offline creates carry the same key into their queued replay so a
  reconnect can never double-create.
- **Degrade-never-die (Law 12):** every screen catches API failures → empty state / inline notice / cached value;
  every SDK call is timeout-bounded.
- **Enumeration-safe OTP:** the phone step always advances to verify regardless of account existence.

## Feature flags / kill-switch (`core/flags`)

Every shippable vertical is gated by a flag (`core/flags/flags.ts`) so ops can disable a bad screen **remotely,
without an app-store release** (Law 10 / guide §6). Resolution: remote config (hydrated best-effort at boot via
`core/flags/hydrate.ts`) → build-time `EXPO_PUBLIC_FLAGS` override → built-in defaults (new/unbuilt features
default **OFF**; the shipped `farmer_app` defaults ON and is remotely killable). The farmer tab group renders a
maintenance state when its flag is off. Unit-tested.

## Push + notification center (`core/push` + `features/notifications`, roadmap P-04)

In-app notification center + push. `core/push`: `fcm` (JIT permission + Expo push token + Android channel),
`notification-router` (**pure** deep-link routing — only honors INTERNAL paths, never an external scheme, so a
crafted push can't redirect off-app), `quiet-hours` (pure wrap-midnight math) and `push` (foreground handler that
suppresses local banners during quiet hours + a tap handler that deep-links via the router). SDK `notifications`
resource (inbox/mark-read/preferences/quiet-hours). Screens: inbox (28/191, All/Unread, SWR-cached), detail (172,
marks read), settings (171, per event×channel `Toggle` + quiet hours). Bell on the farmer home. Behind the
`notifications` flag (OFF). Mark-read is idempotent server-side; the server enforces inbox ownership (no IDOR).

### Flagged backend gap (built real, did NOT fake)
- **No device-token registration endpoint** exists yet (the `communication` module has the push *sender* but no
  client token-sync route). `core/push/fcm.syncPushToken` posts to the assumed `notifications/devices` and
  degrades silently until that endpoint lands — so push *delivery to this device* is pending that route; the
  in-app center is fully real now.

### Threats considered (push / notifications)
- **Malicious deep link in a push:** routing only accepts internal absolute paths (no scheme, no `//host`); the
  destination screen re-authorizes server-side regardless (push is never trusted to act).
- **Token leakage:** the push token is never logged; synced over HTTPS only.
- **Notification spam / cross-user leak:** inbox + prefs are owner-scoped server-side; quiet hours respected both
  locally (foreground) and server-side (delivery).
- **Kill-switch:** the `notifications` flag disables the center + push registration remotely without a release.

## Farmer wallet + transactions + payouts (`features/wallet`, roadmap P-06)

The money home. The wallet **hub** (19) shows the SERVER's reconciled balance (bigint paise via `MoneyText`, Law 2)
and routes to Add money (P-03), **Withdraw**, **Transactions**, and **Payout history**. **Transactions** (21) lists
the caller's payments and **Payout history** (59) lists payouts — both **keyset/cursor-paged** (never offset) via a
shared `TxnList` (FlatList, stable keys, pull-to-refresh, infinite scroll), with a unified **txn-detail** (71).
**Withdraw** (70) is a **real, idempotent** payout (`payouts.request`) to a tokenised bank/UPI destination on file:
a pure `withdrawable` BigInt guard pre-checks amount ≤ balance (UX only — the server re-checks balance/KYC/limits),
`FLAG_SECURE` is on while the screen shows, and a 403/409 maps to a precise "complete KYC"/"exceeds balance"
message. Pure presenters (`presentPayment`/`presentPayout`/`statusTone`/`withdrawable`) are unit-tested. Behind the
`wallet` flag (OFF); add-money keeps `payments_addmoney`.

### Flagged backend gaps (built real where the endpoint exists; did NOT fake the rest)
- **No HTTP wallet-ledger read-model:** the double-entry ledger lives in the gRPC wallet-service. The real money
  movements a user can see are payments (money-in) and payouts (money-out), so Transactions = payments and Payout
  history = payouts (both real keyset endpoints). A single per-entry ledger feed awaits a wallet read-model.
- **Balance** uses the assumed `GET /v1/wallet/balance` (degrades to ₹0 + retry until the read-model lands).
- **Earnings (58)** (settlement credits), **spending-insights (182)**, and **autopay/mandates (181)** have no
  endpoint yet → not shipped (flagged). **Adding a bank/UPI payout destination (180)** is the P-03 flagged gap
  (tokenised `vaultRef`); withdrawal works against destinations already on file, so it shows a clear "add an
  account — coming soon" state when none exist.

### Threats considered (wallet / payouts)
- **Money integrity:** every amount is bigint paise end-to-end (Law 2); the `withdrawable` guard uses BigInt (a
  >2^53 balance is exact, tested). The balance shown is the server's reconciled truth — the client never computes it.
- **Unauthorized withdrawal / fraud:** the payout is authorized **server-side** (balance, KYC, per-user limits,
  destination ownership) — a patched client can't grant itself a withdrawal; a 403 is shown, never worked around.
  Withdrawal is **not** offline-queued: money-out needs a live server decision and an immediate, unambiguous outcome.
- **Replay / double-spend:** the payout POST carries a per-request Idempotency-Key (Law 3), so a retried/duplicated
  request can't pay out twice.
- **IDOR:** transaction/payout detail reads are owner-scoped server-side — a guessed id returns nothing that isn't
  yours. Lists are the caller's own, keyset-paged (bounded; no scraping via offset).
- **PII:** payout destinations are shown masked (last-4 + IFSC, or the VPA) — never a full account number; raw
  account numbers/tokens are never on the client. `FLAG_SECURE` blocks screenshots/recording on the money screens.
- **Kill-switch:** the `wallet` flag disables the whole vertical remotely without an app release.

## Listing photos + voice + manage (`core/voice` + `features/listings`, roadmap P-05)

Sell faster. **Create listing** (screen 10) now picks the product from the catalogue (real `productId`/`categoryId`/
unit — never fabricated), adds up to 6 photos via `core/media` (compress + presigned-PUT upload, per-tile progress/
retry/queue), and lets the farmer **describe by voice**: `core/voice` wraps on-device STT (`@react-native-voice/
voice`) with a **pure** `sttLocaleFor` language→locale map (hi-IN/gu-IN/en-IN, default en-IN), used by the
`useVoiceDictation` hook + ui-native `VoiceButton`. Submit creates a draft and routes to **preview** (screen 11) to
**publish**. **Edit price** (113) is the real edit path — it reloads the listing for its current price + `version`
and PATCHes with optimistic concurrency (a conflict shows a friendly "reopen & retry"). **Repost** (116) prefills
qty/price from a source listing via `?repostFrom=`. Detail screen (112) exposes Edit/Repost/Boost actions. Offline,
the create queues (Law 3 idempotent replay) and returns to the list. Money is always paise via `BigInt` (Law 2).

### Flagged backend gaps (built real, did NOT fake)
- **Voice → structured fields:** there is no server AI endpoint to extract crop/quantity/price from speech, so voice
  fills the **free-text description only** — we never auto-parse money or quantity from audio (a misheard price is a
  financial bug). Behind the `voice_listing` flag (OFF).
- **Boost is a real paid action, not faked:** boosting requires a wallet debit → `txnId` + a boost-tier price lookup,
  neither of which is wired yet, so behind the default-OFF `listing_boost` flag the Boost button honestly says
  "coming soon" rather than flipping a cosmetic `boosted` flag.
- **Full-field edit + listing analytics + a dedicated repost endpoint** have no API yet; only price-edit (real PATCH)
  and prefill-based repost (real create) ship.

### Threats considered (listing media / voice)
- **Untrusted media:** photos upload to S3 via presigned PUT (never through the API host); EXIF is stripped and the
  server runs an async malware/visibility scan before an asset is ever shown — the client only references `mediaId`s.
- **Voice privacy:** STT is **on-device**; raw audio is never uploaded, only the resulting text the farmer can see and
  edit before submit. Mic permission is requested just-in-time; failure degrades to typing (never blocks listing).
- **Price integrity:** all amounts are bigint paise (Law 2); price edits use `expectedVersion` optimistic concurrency
  so a stale screen can't silently overwrite a newer price; the server re-authorizes ownership on every mutation.
- **Spend safety:** Boost can move money, so it stays flagged-off until the wallet-debit path is real — no fake
  "boosted" state, no client-side pricing.
- **Kill-switches:** `voice_listing` and `listing_boost` disable those surfaces remotely without an app release.

## Payments + KYC (`core/payments` + `core/security` + `features/{payments,kyc}`, roadmap P-03)

The money rails. **Add-money** (wallet recharge) is the fully-wired headline path: `features/payments.addMoney`
→ SDK `payments.createIntent` (purpose `wallet_recharge`, idempotency-keyed) → **Razorpay checkout** (UPI/cards/
netbanking) opened with the PUBLISHABLE key from public config → poll our own `payments.get(id)` until terminal.
**Capture is verified server-side by the signed webhook** — the client never trusts the gateway result, it only
reads authoritative status. **KYC status** (`features/kyc.listKyc` → SDK `kyc.list`) shows submitted docs +
pending/verified/rejected. New SDK resources: `payments`, `payouts`, `kyc`, `bankAccounts` (typed, idempotent,
money as bigint-minor strings). `core/security/useSecureScreen` applies **FLAG_SECURE** (expo-screen-capture) on
add-money + KYC screens. Both screens are flag-gated (`payments_addmoney`, `kyc`, default OFF). Pure money/status
helpers (`rupees→paise` via BigInt, terminal-status mapping) are unit-tested.

### Flagged backend gaps (built the real contract, did NOT fake the missing piece)
- **Wallet balance** read-model is an unbuilt API stub — the wallet shows ₹0 + retry (degrade), not a fake number.
- **KYC doc submit** needs a `docTypeId`, but the API exposes no doc-type lookup yet — so this release ships KYC
  *status* only; `submitKyc()` is wired to the real contract for when the lookup lands.
- **Bank add** needs a gateway-tokenised `vaultRef` (no tokenisation endpoint yet) — `listBanks`/`addBank` exist
  against the real contract; the bank-ADD + withdraw screens land with the payouts vertical (roadmap P-06).
- **Aadhaar e-KYC OTP** (screens 72/73) is Phase-2 per the PRD lean scope — not built (no backend).

### Threats considered (payments / KYC)
- **Tampered amount / replayed payment:** amount is server-validated; createIntent is idempotency-keyed; capture
  is webhook-verified server-side (client status is read-only). No money is ever a float (bigint paise).
- **Secret leakage:** only the Razorpay *publishable* key is in the client; the bearer token is never sent to the
  gateway; no gateway secret/signing key is in the bundle.
- **Screenshot/recording of money/KYC:** FLAG_SECURE on those screens.
- **PII:** KYC sends only a masked doc value + an uploaded media id (never the raw number); bank stores
  tokenised vaultRef + last-4 only.
- **IDOR:** payment/KYC/bank reads are owner-scoped server-side; the app shows only the caller's data.
- **Kill-switch:** payments_addmoney / kyc flags can disable these flows remotely without an app release.

## Offline-first reads + sync engine (`core/offline` + `core/connectivity`, roadmap P-02)

The app is usable with no signal. Reads go through a **stale-while-revalidate** cache: `cache-policies.ts` (pure:
per-user-scoped keys + TTL/SWR freshness) + `cache.ts` (read-through engine, store+clock injected) backed by
**`sqlite.db.ts`** (expo-sqlite). FRESH → no network; STALE → serve cached + revalidate in background; MISS →
fetch, **falling back to cached on failure** (degrade-never-die). Cache keys are scoped to the signed-in user
(`scope.ts`) and **wiped on sign-out**, so one account can never read another's cached data (anti-IDOR). Writes
ride the **single dispatched offline queue** (`sync-queue.ts`); the **sync engine** (`sync.engine.ts` +
`core/connectivity` over NetInfo) replays them on the **offline→online edge** and on **foreground**, guarded
against concurrent flushes — so a listing/upload made in a dead-zone syncs the moment signal returns, with the
same idempotency keys (no duplicates). An `OfflineBanner` shows when offline. Farmer home/listings/orders reads
are cached; **wallet balance is intentionally NOT cached** (money correctness > offline staleness — it shows live
or ₹0+retry). Pure logic (policies, SWR engine, transition guards) is unit-tested with in-memory store + fake clock.

### Threats considered (offline cache)
- **Cross-account cache read:** keys are user-scoped and the scope's cache is cleared on sign-out.
- **Stale money:** wallet/ledger reads are never cached; only non-authoritative lists/reference data are.
- **Duplicate write on reconnect/double-flush:** one dispatched queue, idempotency-keyed replay, concurrent-flush
  guard (unit-tested no-dup).
- **Tampered local cache:** cache holds non-secret reads only (tokens stay in SecureStore); the server remains the
  authority and re-authorizes every call, so a doctored SQLite row can't grant access — at worst it shows the user
  their own stale data until revalidation.

## Media capture & upload (`core/media`, roadmap P-01)

Reusable image pipeline every later feature uses (listing photos, KYC docs, PoD, profile, chat): pick from
camera/gallery (`expo-image-picker`, **just-in-time permissions**) → **downscale to ≤1600px + JPEG-compress**
(`expo-image-manipulator`, which also drops EXIF/GPS client-side) → **SHA-256 the exact bytes** (pure
`core/util/sha256` over the decoded file) → presigned **PUT straight to S3** with **progress + bounded retry**
(`expo-file-system`) → confirm size+hash+dims. Offline-first: a network failure **enqueues** the upload on the
shared dispatched queue (`core/offline/sync-queue`) and replays it with the **same idempotency keys** (Law 3) so
a reconnect can't double-create. SDK: new typed `media` resource (`requestUpload`/`confirmUpload`/`downloadUrl`).
ui-native primitives: `UploadTile` (thumb + progress/queued/failed/retry + remove), `AddMediaTile`, `ProgressBar`.

### Threats considered (media)
- **Malicious upload / oversized file:** the API re-validates kind+mime+size and AV-scans every object before it's
  ever downloadable (fail-closed); the client also caps dimensions/quality and only allows an image/doc mime set.
- **EXIF/GPS leak:** the re-encode strips metadata client-side; the server strips again post-scan.
- **Duplicate asset via retry/replay:** `requestUpload` + `confirm` carry stable idempotency keys reused on
  offline replay.
- **Tampered bytes:** sha256 is computed over the SAME decoded bytes that are PUT to S3 and recorded on confirm.
- **Token/URL leakage:** the presigned S3 URL is short-lived; file bytes never pass through (or get logged by) the
  API; the bearer is never sent to S3.
- **IDOR on download:** `download-url` is owner/moderator-scoped and only for clean assets (404 otherwise).

## Threats considered (auth + farmer slice)

The app is treated as fully untrusted (guide §4) — every control below is also enforced server-side:
- **Token theft / patched APK:** access+refresh tokens live only in `expo-secure-store` (Keychain/Keystore),
  never AsyncStorage/logs; the API re-enforces auth + RBAC on every call, so a stolen client can't escalate.
- **OTP enumeration / brute force:** the phone step advances identically whether or not the number exists;
  resend respects the server cooldown; verify attempt-caps are server-enforced (the UI just surfaces them).
- **Replay / double-spend:** the create-listing mutation (and every future mutation) carries a per-action
  idempotency key; the offline queue replays with the **same** key, so a reconnect can't double-create.
- **Money tampering:** money is bigint minor-unit strings end-to-end (`MoneyText`/`formatMoneyMinor`); the
  client never computes balances — it displays the server's reconciled truth.
- **IDOR via deep link:** listing/order ids from params are re-checked for ownership/tenant by the API (the
  client read degrades to an EmptyState on 404, never leaks another tenant's data).
- **Scraping / DoS:** product search is debounced, lists are keyset-bounded; the server owns rate limits.
- **DoS via flaky deps:** every call is timeout-bounded and degrades (Law 12); a hung API never white-screens.
Hardening still owed before GA (roadmap P-30): TLS pinning, root/integrity attestation, release obfuscation,
`FLAG_SECURE` on KYC/payment/wallet screens — tracked in `MOBILE_BUILD_ROADMAP.md`.

## Verification

- `pnpm --filter @krishi-verse/mobile test` → **101 unit tests green** (session reducer, offline queue, helpers,
  feature flags, SHA-256 FIPS vectors, base64, media-mime, cache policies, SWR cache engine, sync transitions,
  payment money/status, quiet-hours, deep-link routing, notification presenters, STT locale map, wallet txn
  presenters + withdrawal BigInt guard) — run offline via ts-jest scoped to `src/core/__tests__`.
  `@krishi-verse/sdk-js` 7/7 still green (payments/payouts/kyc/bankAccounts/notifications/listings-owner resources).
- Screens are thin (guide §3): every API call lives in a `features/<area>/*.api.ts` data layer (farmer
  dashboard, orders, wallet, listings, catalogue) — no screen calls `apiClient` directly. All user-facing strings
  are i18n keys in hi/en/gu (no literals). `.eslintrc.js` (eslint-config-expo) gates lint in CI.
- Shared packages re-confirmed green: `sdk-js` 7/7, `i18n` 6/6, `tokens` typecheck clean.
- All app + ui-native TSX/TS **syntax-parse clean** offline with **zero broken local imports**.
- The full RN app (React Native + native modules + expo-router) compiles under CI's `pnpm install` + `expo`
  toolchain — the monorepo's `workspace:` deps can't be `npm install`ed in the sandbox, so the device build is
  CI-only (the framework-free core above is fully verified here).

## Not yet built

This release delivers the foundation + auth + the farmer listings vertical. The remaining ~180 Phase-1 screens
(other roles, auctions, dairy/MCC, labour, fintech, schemes, education, wallet flows, chat, voice STT, push,
offline SQLite sync, GPS/geofence) are mapped to their feature folders in **`SCREENS_BACKLOG.md`**. The scaffold
files under `src/features/*`, `src/core/{push,voice,location,offline/sqlite,offline/sync}` remain documented
placeholders for those follow-on verticals — no fake screens are wired into the router.
