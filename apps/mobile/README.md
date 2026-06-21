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

## Farmer-side labour booking / hire (`features/labour`, roadmap P-14)

Wave 5 — the EMPLOYER side of the labour marketplace. From the farmer Home (when `labour_hire` is on) a **Hire**
tile opens **My Bookings** (50); from there the farmer can **Browse Workers** (42) with an inline **filter** (43,
region + verified-only), open a PII-minimised **worker profile** (25), and **post a booking** (26 + steps
44/45/62/46/63 + confirm 27) — headcount, dates, wage (₹→paise via BigInt, Law 2), wage-kind, women-only, **farm
GPS via `core/location`**, respond-by — validated by the PURE `buildBookingDraft` and POSTed as a REAL idempotent
`createBooking`. **Booking detail** (51) shows an assignment tally (**accepted 48 / awaiting / declined 49**) and
the employer **lifecycle actions** for the current status: assign workers → **start → complete → pay wages** (or
cancel). Every action is a REAL transition the SERVER authorizes/validates; **pay settles wages server-side** (the
app never moves money — Law 11). New SDK: employer methods on the `labour` resource
(`listWorkers`/`getWorker`/`createBooking`/`assignWorker`/`start`/`complete`/`cancel`/`payWages`/`bookingAssignments`)
+ `CreateBookingInput`. Behind `labour_hire`. Pure `booking-flow` logic unit-tested.

### Flagged backend gaps (built real where the endpoint exists; did NOT fake the rest)
- **No mobile lookups READ endpoint for the work-type / skill / region / skill-level taxonomy.** `createBooking`
  needs those ids, but there's no way to populate pickers from real data — so the booking form collects the real
  fields and `buildBookingDraft` **flags the `taxonomy` group** (entered manually, with a clear "catalogue coming
  soon" note) rather than inventing ids. The submit is the real endpoint; it succeeds once valid ids are supplied
  (and the server still rejects a sub-floor wage — 422).
- **Wage floor is server-owned:** `min_wage` is never client-supplied; the offered wage is checked against the
  statutory floor server-side. The client surfaces the 422 as a precise "raise your wage" message.
- **Assign-from-marketplace:** browsing workers carries an `assignBookingId` so a worker profile can be assigned
  to an open booking (real `assignWorker`); the server re-checks ownership, the 18+ gate, headcount + floor.

### Threats considered (hire / booking lifecycle / wage)
- **Server is the authority on every transition.** assign/start/complete/cancel/pay are owner-or-admin server-side
  (start needs ≥1 accepted worker; pay needs `completed`); a 403/409/422 shows a friendly message, never worked
  around. The client's `bookingLifecycleActions` only decides which buttons to show.
- **No client money movement (Law 11).** Wages are bigint paise (Law 2); `payWages` only signals the server, which
  performs the employer→worker wallet transfer. The rupee→paise conversion + all sums use BigInt, never a float.
- **Idempotency (Law 3).** create / assign / pay carry an Idempotency-Key so a double-tap can't double-post,
  double-assign, or double-pay.
- **IDOR / PII-min.** booking + worker ids from params are re-checked server-side; the worker pool is
  PII-minimised (anonymised id + region/rating/availability — never name/phone). Lists are keyset-bounded.
- **Kill-switch.** `labour_hire` disables the whole employer hire surface without a release.

## Worker active job: geo-attendance + earnings + reviews (`features/labour` + `core/location`, roadmap P-13)

Wave 5 — the worker's active engagement. From Home (when `worker_active_job` is on) the worker reaches **My Jobs**
(32, assignments bucketed Upcoming / Paid / Closed via the PURE `categorizeAssignments`), an **Active Job** (33)
with **geo-fenced clock-in**, **Payment received** (34), **Earnings** (35, a BigInt sum of paid wages — Law 2),
**Withdraw** (41, reusing the wallet payout path), and **My Reviews** (40, reputation). The DoD centrepiece is the
**clock-in geofence**: new `core/location` ships PURE `haversineMeters` / `clockInEligibility` (within **100 m**,
usable GPS accuracy) plus a resilient one-shot `getCurrentFix` over expo-location (permission JIT, timeout-bounded,
degrade-never-die). The withdraw screen is `FLAG_SECURE`. Behind `worker_active_job`. No new SDK — everything reads
over the existing `labour` (assignments/bookings), `payments`/`payouts` (wallet), and `reviews` contracts.

### Flagged backend gaps (real geofence + reads built; NOT faked)
- **No attendance/clock-in endpoint, and the booking read-model omits farm lat/lng.** So the geofence is computed
  for real (the honest, unit-tested invariant) and, on a pass, the UI says "you're at the farm — attendance
  recording is coming soon" instead of POSTing to a non-existent endpoint or inventing coordinates. `farmOf()`
  reads the coords defensively so the fence lights up the instant the contract adds them.
- **Wages are employer-initiated** (the labour service settles completed→paid via a wallet transfer); the worker
  side reflects `paid` status + sums earnings. There is no worker-triggered EOD payout in the app (Law 11).
- **No insurance/PMSBY** in the fintech module → Insurance (39/145/146) is an honest "coming soon", not a fake
  policy/claim flow. **Earnings total** sums the loaded keyset page (no server aggregate endpoint yet) and shows a
  "+ more" hint when older pages remain. **Worker reviews** use the generic reviews summary keyed to the worker's
  user id + the profile's own bookings/no-show counters (no labour-specific review endpoint yet).

### Threats considered (attendance / wage / location)
- **Geofence is UX, the server is the authority.** A rooted device can spoof GPS, so `clockInEligibility` only
  gates an honest worker's UI; a real attendance write must re-verify the fix server-side. The fence fails closed
  (NaN/∞ → Infinity → "too far") and rejects low-accuracy fixes so a vague fix can't sneak past the 100 m gate.
- **No client money movement (Law 11).** Earnings are bigint paise summed with BigInt (never a float); the worker
  never moves money — wage settlement is the server's. Withdraw is a REAL, idempotent payout (Law 3) the SERVER
  authorizes (balance/KYC/limits); a 403/409 shows a precise message, never worked around.
- **Permissions & privacy.** Location is requested just-in-time with rationale, read once (no continuous polling —
  battery/data on low-end Android), and never logged. The withdraw screen is `FLAG_SECURE`; bank destinations are
  shown masked (last-4 / VPA only). IDs from params are re-checked server-side (IDOR); lists are keyset-bounded.
- **Kill-switch.** `worker_active_job` disables the whole active-job/earnings/attendance surface without a release.

## Worker app: onboarding + jobs (`features/labour`, roadmap P-12)

Wave 5 — the labour-marketplace differentiator. A `worker` role (added to the role switcher, home `/(worker)/home`)
with its own tab group: **Home** (29), **Jobs** (30/31), **Offers** (141/142) and **Profile** (38/36/136/139).
A worker **registers a profile** (availability: travel radius, stay-away tolerance, min-wage expectation in paise
via BigInt, emergency contact) — the onboarding target is **<10 min**. They **browse open bookings** (`box=open`,
a real marketplace read) and view a **read-only job detail**. Work arrives as **employer-initiated assignments**:
the **offer detail** shows the wage on the table + the **respond-by window**, and — only when the worker is
**18+ verified** — an **accept / decline** control; the 4-hour accept/decline window and the hard 18+ Aadhaar gate
are **enforced server-side** (the client's `canAcceptWork` + window text are UX-only). New SDK: `labour`
(`registerWorker`/`myWorker`/`updateWorker`/`listBookings`/`getBooking`/`listAssignments`/`getAssignment`/`respondAssignment`).
Behind `worker_app` (the mobile vertical) over the server-side `labour` module flag. Pure `labour-status` logic
unit-tested.

### Flagged backend gaps (built real where the endpoint exists; did NOT fake the rest)
- **No worker-"apply" endpoint (140):** jobs are employer→worker assignments, so the job detail is read-only with a
  clear note ("work is offered to you by the employer; accepted offers appear in Offers") rather than a fake apply
  button. Browsing open bookings is real.
- **No skills field in the worker DTO (37/137):** the "add skill / skills" UX is flagged "coming soon" instead of
  posting to a non-existent field.
- **Ambassador-led onboarding + 18+ Aadhaar:** `ageVerified18` is server-set out-of-band via KYC (P-03); the accept
  control stays hidden until the server reports the worker verified — the app never self-asserts age.

### Threats considered (worker / labour / 18+)
- **Hard 18+ gate is server-owned:** the app cannot accept work for an unverified worker — `canAcceptWork` only
  hides the control; the server rejects an accept from a non-verified or under-18 worker (Aadhaar KYC is authority).
- **4-hour respond window is server-enforced:** the client shows "respond before it closes", but a late
  accept/decline (409/422) shows "this offer's window has expired" — never worked around client-side.
- **No client money movement (Law 11):** wages are bigint paise (Law 2); the worker never moves money — wage
  settlement on completion is a server job. `respondAssignment` only signals accept/decline.
- **Idempotency:** register + respond carry an Idempotency-Key (Law 3) — a retried accept can't double-book.
- **IDOR / enumeration:** booking + assignment ids from params are re-checked server-side; lists are keyset-bounded
  (`box=open` / `box=mine`). Emergency-contact + min-wage are the worker's own; no other worker's PII is exposed.
- **Kill-switch:** the `worker_app` flag disables the whole worker vertical without a release.

## Auction discovery + bidding + live (`features/auctions`, roadmap P-11)

Wave 4. Browse **auctions** (Live/Ended), open the **detail** which **polls every 4s** (watch-live; degrades to
pull-to-refresh), and **place a bid** — the bid holds an **EMD (earnest-money deposit) on the bidder's wallet
SERVER-SIDE**, and the loser's EMD is refunded + the winner→settlement run entirely server-side (the app never
moves money — Law 11). Current price + minimum-next-bid come from the PURE `auction-status` helpers (bigint, Law 2);
an **outbid banner** (193) reflects when you're no longer the top bidder (the authoritative nudge is the P-04
push). Bid history (194) is shown, with sealed-auction amounts masked server-side. Sellers **create an auction**
(64) from a listing (start price + increment + duration). New SDK: `auctions`. Behind `auctions` (+ `buyer_app`
for the browse side, `farmer_app` for create). Pure logic unit-tested.

### Flagged backend gaps (built real where the endpoint exists; did NOT fake the rest)
- **EMD amount isn't in the read model:** the auction read shape exposes start/reserve/increment but not the EMD,
  so we show a clear "a refundable deposit is held" note rather than a fabricated number; the hold/refund are real
  and server-side. The wallet (P-06) reflects the hold/refund.
- **No cross-auction "my-bids" (18) endpoint:** the bid history is per-auction, so the detail marks your own bids
  ("You") inline; a standalone my-bids list across auctions awaits a server read-model (flagged, not faked).
- **Live is poll-based** (4s), not a socket — the DoD allows poll-or-socket; a websocket upgrade is a later
  optimization. Product title on the detail is fetched via the public listing read (the auction read has no title).

### Threats considered (auctions / EMD / bidding)
- **Server is the authority on every bid:** the legality of a bid (highest, increment, EMD availability, timing)
  and the EMD hold are enforced server-side; the client's `validateBidRupees` is UX-only. A rejected bid (409/422)
  shows "someone bid higher — refresh", never worked around. Winner declaration + EMD refund are server jobs.
- **No client money movement (Law 11):** placing a bid only calls the endpoint; the EMD hold + loser refund +
  winner settlement happen server-side. Amounts are bigint paise end-to-end (Law 2); the rupee→paise + comparisons
  use BigInt, never a float.
- **Idempotency:** create-auction + place-bid carry an Idempotency-Key (Law 3) — a retried bid can't double-hold
  EMD or place two bids.
- **Sealed-bid privacy:** other bidders' amounts are masked **server-side** until close; the client renders the
  null amount as "Sealed" — it never receives the hidden value.
- **IDOR / scraping:** auction + bid ids from params are re-checked server-side; lists are keyset-bounded; bidding
  is rate-limited at the edge and the poll interval is bounded (4s) so the app isn't an auction-sniping vector.
- **Kill-switch:** the `auctions` flag disables discovery + bidding + create without a release.

## Offers + chat + masked call (`features/offers` + `features/messaging`, roadmap P-10)

Negotiate and talk without leaking a phone number. From a listing the buyer can **Make an offer** (99 →
`offers.make`, per-unit price in paise via BigInt, Law 2) or **Chat with seller** (opens a `direct` conversation).
The **offer detail** shows the price on the table + status and — while negotiable — **accept / counter / reject**;
**accept converts the offer into an order SERVER-SIDE** (`convertedOrderId`) and we route to it (DoD: offer
accepted → order created). **Chat** (98) lists messages keyset-paged, **polls every 5s** while focused
(realtime-ish), and sends **text or an image** (core/media compress + presigned upload → `attachmentMediaId`; bytes
never touch the API). A **masked-call** button bridges the two real numbers SERVER-SIDE — **no phone number is ever
returned to the client**. The pure `offer-status` + `message-view` are unit-tested. New SDK: `offers`,
`conversations`, `maskedCalls`. Behind `offers_chat` (+ `buyer_app`).

### Flagged backend gaps (built real where the endpoint exists; did NOT fake the rest)
- **Chat is poll-based, not socket:** the API exposes keyset message reads, so the thread polls every 5s (the DoD
  allows poll-or-socket); a websocket upgrade is a later optimization.
- **Inline media thumbnails:** sending an image is real (upload → `attachmentMediaId`), but rendering the thumbnail
  inline needs the media download-link wiring, so an image message shows a "📷 Photo" chip for now (flagged).
- **Seller-side incoming offers** (accept/counter from the farmer) reuse the same shared `features/offers` + the
  real `box=incoming` endpoint; the farmer UI for it is a follow-up. The buyer can accept a seller's counter today,
  which exercises the full accept→order path.

### Threats considered (offers / chat / masked call)
- **No PII leak:** masked calls bridge the two numbers server-side via the telephony provider; the API returns a
  call record with **no phone number** ever. Chat carries no numbers; the UI shows "number hidden" on the call CTA.
- **Server is the authority on negotiation:** offer transitions (accept/counter/reject) + who may act (buyer vs the
  listing's seller) are enforced server-side; an out-of-turn tap gets 403/409, shown friendly, never bypassed.
  Accept→order creation + escrow are entirely server-side (the app never moves money — Law 11).
- **IDOR:** conversations are membership-gated server-side (a non-participant gets 404, not another's thread);
  offer/conversation/message ids from params are re-checked by the server.
- **Idempotency:** make-offer, open-conversation, post-message, and initiate-call all carry an Idempotency-Key
  (Law 3) — a double-tap can't double-send or double-bridge.
- **Untrusted attachments:** images upload to S3 (EXIF-stripped, malware-scanned) and are referenced by id; the
  client sends no bytes through the API. Messages can be flagged for moderation server-side (shown as a marker).
- **Money:** offer prices are bigint paise end-to-end (Law 2); the rupee→paise helper uses BigInt, never a float.
- **Kill-switch:** the `offers_chat` flag disables offers + chat + calls without a release.

## Buyer cart → checkout → order (`features/cart` + `features/addresses`, roadmap P-09)

The purchase loop. Add-to-cart from a listing → **cart** (96) reads the SERVER's live cart (prices/availability
recomputed, Law 2 `MoneyText`), steps quantity within stock, and shows blockers via the pure `cart-math`
(`canCheckout`/`cartBlockers`). **Checkout** (15) picks a delivery address from the **address book** (129/134:
list/add/delete), takes an optional **coupon**, and **places the order** — a real, idempotent (Law 3) cart→orders
conversion; the authoritative delivery/tax/discount/commission totals are computed **server-side** and shown on
the resulting order (we never compute them client-side). If online payments are on, it then pays the primary order
via the gateway (`payForOrder` → `direct_order` intent → Razorpay → poll); **escrow is held server-side** on
capture — the app never moves money (Law 11). FLAG_SECURE on checkout. Buyer **orders** list (22/69) + **detail**
(23) + **tracking** (131) reuse the shared `features/orders` + `order-status`; a **profile** tab shows KYC status
(133, shared `features/kyc`) + sign-out. Behind `buyer_checkout` (+ `buyer_app`). New SDK: `cart`, `checkout`,
`addresses` resources. Pure `cart-math` is unit-tested.

### Flagged backend gaps (built real where the endpoint exists; did NOT fake the rest)
- **No checkout totals-preview endpoint:** totals are computed during the checkout transaction, so the checkout
  screen shows the cart subtotal + an honest "final totals shown on your order" note rather than a faked preview;
  the real breakdown is read back on the order (P-07 detail).
- **Payment method (130):** online (gateway) is the real, wired path; **pay-from-wallet for an order** has no
  wallet-debit endpoint, so it's folded into checkout (online) and wallet-pay is deferred, not faked.
- **Buyer review/report** from the order detail are deferred to a follow-up (the shared screens exist for farmers);
  buyer order detail ships cancel/complete/track.

### Threats considered (cart / checkout / pay)
- **Idempotent checkout:** the cart→orders POST carries an Idempotency-Key (Law 3); a retried/double-tapped
  "Place order" can't create duplicate orders. Checkout is online (not queued) — it needs live stock/price/coupon
  validation and an immediate result.
- **Server is the authority on money:** line totals, the subtotal, charges, tax, and the **coupon discount** are
  all computed + redeemed SERVER-SIDE (the coupon is redeemed atomically in the checkout tx). A patched client
  can't grant itself a discount or a price; the app only displays what the server returns. All amounts are bigint
  paise (Law 2).
- **Escrow / no client money movement:** payment capture + escrow hold happen server-side via the signed webhook;
  the app only opens the gateway sheet and polls status (Law 11). FLAG_SECURE covers the checkout surface.
- **IDOR / PII:** the cart and addresses are owner-scoped server-side; an address id from a param is re-checked.
  Contact name/phone are PII held server-side and shown only to the owner; never logged.
- **Stock/price races:** `cart-math` blocks checkout on unavailable/insufficient items and surfaces price changes;
  the server re-validates at checkout (a 409 → "review and retry", a 422 → "coupon invalid"), never worked around.
- **Kill-switch:** the `buyer_checkout` flag disables cart/checkout/place+pay remotely without a release.

## Buyer browse + search + listing detail (`features/buyer`, roadmap P-08)

The customer purchase loop begins. A new `(buyer)` tab group (Home / Search / Saved), auth-gated + behind the
`buyer_app` flag. **Browse/search** run on the real anonymous public catalogue (`listings.browse`, keyset/cursor)
through the SWR cache, so a repeat search is instant and works on 3G/offline (DoD: <2s via cache). A shared
`BrowseList` does pull-to-refresh + infinite scroll; **filters** (sale type / organic / price range / sort) are
built by the PURE `search-query` (rupees→paise via BigInt, Law 2; empties dropped). **Listing detail** shows the
price, qty, organic/promoted, and a seller link. **Saves** (listings / sellers / searches) are persisted
**on-device** (user-scoped) and survive restarts; the saved screen has Listings/Searches/Sellers sub-tabs and a
saved search re-applies its filters. Pure logic (`search-query`, `saved-set`) is unit-tested.

### Flagged backend gaps (built real where the endpoint exists; did NOT fake the rest)
- **No public media URLs** in the listing read-model yet, so the detail "gallery" is a neutral placeholder, not a
  fake image (the create-listing media pipeline exists; the public read-model exposure is pending).
- **No server saved/wishlist or saved-search endpoint**, so saves are on-device (real persistence, just not yet
  synced/cross-device) — they'll move to a server wishlist when it lands.
- **No public seller-profile endpoint** (name/bio/their listings); the seller screen shows the **real** rating
  summary (`reviews.summary`) + follow toggle and flags the rest. Browse has no `sellerUserId` filter yet.
- **OpenSearch** powers search server-side; the app calls the same `listings` browse contract, so this is
  transparent to the client.

### Threats considered (buyer browse / saves)
- **Scraping the catalogue:** browse is anonymous + public by design, but the server enforces per-IP/-device rate
  limits + bot defenses; the client bounds page size (keyset, limit ≤ 20), debounces search (350ms), and never
  hammers — it must not be the catalogue's DoS vector. No offset pagination.
- **IDOR:** a listing/seller id from a param is just passed to the server, which returns only visibility-gated
  public data; saved data is on-device and scoped to the signed-in user (`currentScope()`), so one account can't
  read another's saves.
- **Money:** prices are bigint minor strings (Law 2); price-range filters convert via BigInt, never a float.
- **Storage:** saves are non-secret and go through AsyncStorage (never SecureStore); no token/PII is persisted.
- **Kill-switch:** the `buyer_app` flag disables the whole vertical remotely without a release.

## Farmer orders + delivery + PoD (`features/orders` + `features/reviews`, roadmap P-07)

Fulfilment. The orders tab (56/22) has a **Selling/Buying** switch → keyset-paged, SWR-cached lists; tap → **order
detail** (57/23) with the money breakdown (Law 2 `MoneyText`), line items, status, and an **action bar built from
the PURE `nextActions(status, role)`** state map. Sellers drive the lifecycle — confirm → packed → ready →
(record delivery) → complete — each a real, idempotent transition (the SERVER state machine is the authority;
a 409 "already moved" / 403 "not allowed" is shown, never worked around). **Proof of delivery** (PRD DoD): the PoD
screen captures the buyer's **OTP + a delivery photo** (core/media compress+upload) and calls
`POST /shipments/:id/deliver` — the OTP is verified server-side (hash compare); `FLAG_SECURE` is on. **Track** (131)
renders a shipment progress `Timeline` from the pure `trackingSteps`. **Review** (24) posts 1–5 stars after
completion (target resolved server-side, anti-IDOR). **Report** (135) files a dispute. New SDK resources: `orders`,
`shipments`, `reviews`. Mutating actions are behind the `orders_fulfilment` flag (OFF); viewing always works.

### Flagged backend gaps (built real where the endpoint exists; did NOT fake the rest)
- **PoD requires a shipment assigned to the caller** (`shipments?box=mine&orderId=`). For self-pickup orders with no
  shipment, the PoD screen says so honestly — handover then completes via the order lifecycle, not a faked OTP.
- **Push-driven <30s status reflection** (DoD) rides on P-04 notifications (flagged); today the list/detail refresh
  on focus + pull-to-refresh. **Payout-on-completion** is the server's OrderCompleted→settlement handler (real,
  module 4) — the app just triggers `complete`; it never moves money itself (Law 11).

### Threats considered (orders / PoD / reviews)
- **Server is the authority on every transition:** the app offers actions via `nextActions` for UX only; a patched
  client calling `confirm`/`deliver` out of turn is rejected by the entity state machine + RLS. No client privilege.
- **PoD integrity:** the OTP is issued server-side to the buyer and verified server-side (we send the raw code; the
  server hashes + compares) — the seller can't self-certify delivery. PoD photos upload to S3 (EXIF-stripped, scanned)
  and are referenced by `mediaId` only. The OTP screen is `FLAG_SECURE`.
- **Replay / double-fire:** every lifecycle POST + PoD + review carries an Idempotency-Key (Law 3). Transitions are
  online (not offline-queued) precisely because blind replay of a stale state change is wrong — they need live state.
- **IDOR:** order/shipment reads are ownership-scoped server-side; a guessed id returns nothing that isn't yours.
  Reviews never accept a client-supplied target — it's derived from the verified completed order.
- **Money:** all amounts are bigint minor strings end-to-end (Law 2); the app reads totals, never computes settlement.
- **Kill-switch:** `orders_fulfilment` disables all mutating actions + PoD/track/review/report without a release.

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

- `pnpm --filter @krishi-verse/mobile test` → **185 unit tests green** (session reducer, offline queue, helpers,
  feature flags, SHA-256 FIPS vectors, base64, media-mime, cache policies, SWR cache engine, sync transitions,
  payment money/status, quiet-hours, deep-link routing, notification presenters, STT locale map, wallet txn
  presenters + withdrawal BigInt guard, order-status action map + PoD-OTP + tracking steps, buyer search-query +
  saved-set, cart-math + address format, offer-status + chat message-view, auction current-price/min-next/bid
  validation/outbid, labour booking/assignment tones + assignment actions + 18+ canAcceptWork gate +
  rupees→wage-minor + buildWorkerPatch + isJobOpen, geofence haversine/clock-in-100m-eligibility/distance-parts,
  worker-jobs bucketing + BigInt earnings sum + clock-in precondition, hire booking-lifecycle actions + assignment
  tally + buildBookingDraft validation + wage rupees→paise) — run offline via ts-jest scoped to `src/core/__tests__`. `@krishi-verse/sdk-js` 7/7 still
  green (payments/payouts/kyc/bankAccounts/notifications/listings/orders/shipments/reviews/cart/checkout/addresses/
  offers/messaging/auctions resources).
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
