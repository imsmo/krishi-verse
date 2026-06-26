# Mobile Phase-1 screen backlog (196 screens)

Source of truth: `../../Phase-1 all screen design/Krishi_Verse_Design_System/screens/*.html` (196 final designs).
This file maps every screen group to its app location and build status, so the remaining verticals can be picked
up one at a time against the same foundation (ui-native + core + expo-router) shipped this release.

Legend: ✅ built this release · 🟡 partial · ⬜ scaffolded (folder exists, screens to build).

## Foundation & onboarding (screens 01–05, +offline/permissions/tutorial) — ✅
- 01 welcome, 02 language, 03 OTP, 04 role, 05 profile-setup → `src/app/(auth)/*` ✅
- Shared shell: theme + ui-native primitives, i18n (hi/en/gu), secure token store, offline queue, auth store ✅
- offline-mode / permissions / server-error / tutorial screens → `src/app/(system)/*` ✅ (P1-17). Plus a GLOBAL
  render-crash boundary (`core/errors/AppErrorBoundary` → server-error panel, mounted at root `_layout`) and a
  `+not-found` route so a bad deep-link / failed render NEVER white-screens (Law 12). i18n hi/en/gu parity; pure
  fallback helpers (`classifyFallback` / `safeErrorRef`) unit-tested.

## Farmer (≈36 screens) — 🟡 (home + listings vertical built)
- ✅ 09 home, 10 create-listing (photos + voice), 11 listing-preview→publish, 12 my-listings, 112 my-listing-detail
  (Edit/Repost/Boost actions), 113 edit-price (optimistic `version`), 116 repost (via `?repostFrom`)
- ✅ tabs: orders, wallet, profile (farmer)
- ✅ wallet vertical (P-06): 19 wallet-home (hub), 20 add-money, 21 transactions, 70 withdraw, 71 txn-detail,
  59 payout-history → `src/features/wallet` (behind `wallet`/`payments_addmoney` flags)
- ✅ orders+delivery vertical (P-07): 56/22 orders (Selling/Buying), 57/23 order-detail (lifecycle action bar),
  PoD (OTP+photo), 131 order-track (Timeline), 24 review, 135 report-order → `src/features/orders` +
  `src/features/reviews` (behind `orders_fulfilment` flag; SDK orders/shipments/reviews resources)
- 🟡 114 boost (flagged `listing_boost` OFF — real wallet-debit path pending), 115 analytics (no API yet),
  58 earnings / 180 UPI-mgmt / 181 autopay / 182 spending-insights (no endpoint yet — flagged)
- ✅ mandi + weather vertical (P-19): 52 mandi-prices (browse yards), 53 mandi-detail (today's prices),
  111 mandi-history (keyset + trend), 110 mandi-alerts (create from a price row + activate/deactivate),
  54 weather (regional advisories), 117 weather-detail, 118 weather-settings → `src/features/market` (behind
  `mandi_weather`; SDK `market`/`weather` resources). Money bigint-minor (Law 2); alert create idempotent; alert
  delivery via server push (P-04). Weather = regional advisories (not a live forecast); price rows carry
  product/grade by id (commodity-name join later) — flagged, never faked.
- ✅ tips + crop hub + AI assistant (P-20): 55 tips-library (search + kind chips), 101 tip-detail (save toggle),
  102 category, 103 saved-tips (device-local), 104 crop-hub (grouped), 125 AI-chat (typed/voice), 184 voice-search
  → `src/features/content` (behind `tips_assistant`; SDK `resources`/`assistant`). Tips read through the SWR cache
  → browsable offline; AI chat wires the assumed `ai/assistant/messages` (degrades honestly — no farmer AI endpoint
  yet); voice = on-device STT (P-05) → local tip search. Categories = resource KIND (topic-name join later); saved
  tips are per-user device bookmarks (no server wishlist yet) — flagged, never faked.
- ✅ govt schemes (P-21): 60 schemes (catalogue, cached→offline), 105 detail + explainable eligibility check,
  106 apply (doc upload via P-01 + consent → apply+submit, FLAG_SECURE), 107 status (state + DBT credits +
  resubmit/appeal), 108 docs (FLAG_SECURE), 109 my-schemes → `src/features/schemes` (behind `schemes_govt`; SDK
  `schemes`). Eligibility attributes entered by farmer (no profile auto-fill); doc-type names not exposed (UUIDs →
  "Document N"); doc mediaIds carried in formData (no doc-attach endpoint); DBT observed server-side — all flagged.
- ✅ profile/farm/bank/docs + help (P-22): 61 profile-own (hub + links), 119 edit-profile (PATCH /users/me),
  120 farm-details (parcels list+register), 121 bank-accounts (masked + UPI add, FLAG_SECURE), 122 documents (KYC,
  FLAG_SECURE), 123 help (tickets + SLA + CSAT), 124 complaint (open ticket) → `src/features/profile` (behind
  `farmer_profile`; SDK `users.me`/`updateMe` + `support` + `parcels`). Bank add = UPI only on mobile (full
  account needs server vault step — flagged); profile read minimal (name/locale); SLA server-owned. The farmer
  vertical (≈36 screens) is now feature-complete for Phase-1.

## Buyer (≈19) — 🟢 (browse + purchase loop built; P-08/P-09)  `src/features/buyer`, `cart`, `addresses`
- ✅ browse vertical (P-08): 13 home, 67 search-results, 68 filters, 14 listing-detail, 100 seller-profile,
  126/127/128 saved (listings/searches/sellers) → `src/app/(buyer)/*` + `src/features/buyer` (behind `buyer_app`).
  Saves are on-device; detail gallery + full seller profile flagged.
- ✅ purchase loop (P-09): 96 cart, 15 checkout, 129/134 addresses, 22/69 buyer-orders, 23 detail, 131 track,
  132 profile, 133 kyc-status → `src/features/cart` + `src/features/addresses` (behind `buyer_checkout`; SDK
  cart/checkout/addresses; reuses features/orders + features/kyc). Idempotent checkout, server-side coupon/totals,
  gateway pay (escrow server-side). Totals-preview + wallet-pay(130) folded/flagged; buyer review/report deferred.
- ✅ offers + chat (P-10): 99 make-offer, offers list/detail (accept→order/counter/reject), 97 chats, 98 chat
  thread (text+image, 5s poll), masked-call launch → `src/features/offers` + `src/features/messaging` (behind
  `offers_chat`; SDK offers/conversations/maskedCalls). Chat polls (no socket); inline image thumbnail + seller
  incoming-offers UI flagged.
- ⬜ buyer reviews/report from detail; seller incoming-offers UI (farmer).

## Worker / labour (≈25) — 🟢 (onboarding + jobs + active-job built; P-12/P-13)  `src/features/labour` + `core/location`
- ✅ P-12 `(worker)` group: worker-home (29), browse-jobs (30) + read-only job-detail (31), job-offer accept/decline
  (141/142) gated on **18+ verified** + server 4h window, register/edit-availability profile (38/36/136) + KYC
  status (139). SDK `labour`; PURE `labour-status` tested.
- ✅ P-13 active-job vertical (behind `worker_active_job`): my-jobs (32, bucketed), active-job (33, **100 m
  geofence clock-in** via `core/location`), payment-received (34), earnings (35, BigInt sum), withdraw (41, reuses
  wallet payout + FLAG_SECURE), my-reviews (40), insurance (39 flagged). PURE geofence + worker-jobs tested.
- ✅ P-14 farmer-side hire (behind `labour_hire`, under (farmer)/hire): my-bookings (50), browse-workers (42) +
  filter (43), worker-profile (25) + assign, book-worker (26/44/45/62/46/63) + confirm/sent (27/47) with farm GPS,
  booking-detail (51) lifecycle + accepted/rejected (48/49). SDK employer methods; PURE `booking-flow` tested.
- ⬜ apply (140 — no endpoint, employer-initiated), add-skill/skills (37/137 — no DTO field), work-history (138),
  PMSBY-enrol/claim (145/146 — no insurance backend), dispute/help (143/144); book-worker work-type/skill/region
  pickers await a lookups read endpoint (taxonomy flagged in `buildBookingDraft`).

## Auctions (P-11) — 🟢  `src/features/auctions` (behind `auctions`)
- ✅ 16 auction-detail (+65 watch-live 4s poll, 66 ended, 193 outbid banner, 194 bid history), 17 place-bid (EMD
  held server-side), 64 create-auction (seller, from a listing) → `(buyer)/auctions/*` + `(farmer)/create-auction`.
  SDK `auctions`. Flagged: EMD amount not in read model (shown as note); 18 my-bids cross-auction (no endpoint,
  own bids marked inline); live = poll not socket.

## Vyapari / trader (subset of buyer + auctions ≈5) — 🟡 (auctions shared via P-11)  `src/features/auctions`, `vyapari-home`
- ✅ auctions reuse P-11 (`src/features/auctions`). ⬜ market dashboard, requirements inbox, supplier shortlist,
  vyapari-home.

## FPO / Business owner — tenant-admin-lite (≈28 tenant screens) — 🟡 (dashboard + approvals + ops built; P-17)  `src/features/tenant` (behind `tenant_admin_lite`)
- ✅ P-17 `(owner)` group: dashboard (08, KPIs), apply/pending (06/07), farmers (76) + detail (77) + add-farmer
  (78), approvals (147) → approve (148, the DoD's "approve a farmer"), disputes (155) → detail (156,
  review/escalate/resolve), listings (79) + payouts (80) monitoring. SDK `tenancy`/`rbac`/`disputes`/`users`;
  PURE `tenant-admin` tested. Law 11: no god-mode — all actions server-authorized + tenant-scoped.
- ✅ P-18 analytics (84/150-152, 15-report catalogue → web), custom-report(153)/export(154)/broadcast(157)/
  campaigns(158)/payment-settings(159)/notif-settings(160)/integrations(161)/compliance(81)/branding(82)/
  bulk-actions(149) as validated web-console handoffs (`core/deeplink`), billing(85, real subscription), team(83).
  PURE `web-console` (report catalogue + safe-URL) tested.
- ⬜ inline analytics charts + mobile broadcast send await tenant analytics/broadcast read+send APIs; heavy/
  destructive admin stays on `apps/web-tenant`.

## Village ambassador (≈19) — 🟢 (onboarding + earnings + training built; P-15/P-16)  `src/features/ambassador` + `features/education`
- ✅ P-15 `(ambassador)` group: home (86, acquisition funnel), farmers (87, referrals), earnings (BigInt commission),
  onboard-start (88, create referral code) → complete (91, share), onboard-scan (89)/verify (90) flagged,
  help-listing (162)/help-order (163) guides, visit-log (164, real GPS capture, save flagged). SDK `ambassadors`;
  PURE `referral-flow` tested. Attribution = referral code → claim → server-recorded commission.
- ✅ P-16 (behind `ambassador_training`): commissions (92, BigInt ledger + load-more), withdraw (168, wallet payout
  + FLAG_SECURE), training (94) → course detail + enrol → lesson (165, video via presigned URL) → quiz (166,
  parse+score+submit), faq (167), profile (95). SDK `courses`/`enrollments`; PURE `learn` tested.
- ⬜ assisted account-create from docs / on-behalf listing/order / visit-log persistence (no endpoints), leaderboard
  (93)/targets (169)/goal-setting (170) (no endpoints), AEPS/UPI, kiosk mode, in-app video player.

## Cross-cutting feature verticals — ⬜
- Wallet flows (add-money, history, bank accounts, autopay, spending insights, UPI) → `src/features/wallet`
- Dairy / MCC operator (milk diary, MCC slip, bill, D2C) → `src/features/dairy`, `mcc-operator`
- Livestock + vet (animal list/detail, health record, vet booking) → `src/features/livestock`, `vet`
- Fintech (loan products/application, credit score, insurance) → `src/features/fintech`
- Schemes (browse/apply/status/docs, DBT) → `src/features/schemes`
- Education (courses, lesson player, certificate) → `src/features/education`
- Delivery partner (tasks, route map, pickup OTP, POD, earnings) → `src/features/delivery-partner`
- Store owner (inventory, orders, batches/expiry, licence) → `src/features/store-owner`
- Notifications / inbox (2), messaging/chat, support (help, ticket, feedback) → `src/features/notifications`,
  `support`, `buyer-browse/BuyerChat`
- ✅ system + settings + search (P-23): 183 global-search, 75 settings, 187 language, 178 privacy, 179 data-download,
  177 account-delete, 176 change-phone, 185 permissions, 186 tutorial, 188 offline, 189 server-error, 190 app-update,
  196 about, 195 feedback → `src/app/(system)/*` + `src/features/system` (search/DPDP/change-phone/feedback behind
  `system_screens`; fallbacks render unconditionally). Search fans out over listings+orders (no search endpoint);
  DPDP export/delete + change-phone wire assumed endpoints + degrade honestly (not live); feedback opens a real
  support ticket; forced-update is config-driven. The Phase-1 mobile screen catalogue is now complete.

## Cross-cutting infrastructure still to wire (folders present as documented placeholders)
- ✅ `core/voice` — on-device STT for the Speak-to-Sell flow (locale map + dictation hook + VoiceButton wired into
  create-listing, behind `voice_listing`). Pending: server LLM extraction of crop/qty/price; TTS.
- `core/push` — FCM registration + notification routing.
- `core/location` — GPS + geofence (delivery, mandi proximity).
- `core/offline/sqlite` + `sync.engine` — durable read cache + bidirectional sync (the write queue is built).

Each vertical follows the pattern shipped here: a `features/<area>` data layer on the SDK (degrade-never-die,
idempotent mutations, offline-queue for writes), screens under `src/app/(role)/…`, money via `MoneyText`
(bigint minor), i18n keys (not literals), and unit tests for any non-trivial pure logic.
