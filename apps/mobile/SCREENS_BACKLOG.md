# Mobile Phase-1 screen backlog (196 screens)

Source of truth: `../../Phase-1 all screen design/Krishi_Verse_Design_System/screens/*.html` (196 final designs).
This file maps every screen group to its app location and build status, so the remaining verticals can be picked
up one at a time against the same foundation (ui-native + core + expo-router) shipped this release.

Legend: ✅ built this release · 🟡 partial · ⬜ scaffolded (folder exists, screens to build).

## Foundation & onboarding (screens 01–05, +offline/permissions/tutorial) — ✅
- 01 welcome, 02 language, 03 OTP, 04 role, 05 profile-setup → `src/app/(auth)/*` ✅
- Shared shell: theme + ui-native primitives, i18n (hi/en/gu), secure token store, offline queue, auth store ✅
- offline-mode / permissions / server-error / tutorial screens → `src/core/*` infra present; dedicated screens ⬜

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
- ⬜ tips/crop-hub (101–104, 125 AI chat), schemes (105–109), mandi detail/alerts/history (110–111),
  weather (117–118), edit-profile/farm/bank/docs (119–124) → `src/features/farmer-home`, `farmer-*` folders.

## Buyer (≈19) — ⬜  `src/features/buyer-browse`, `buyer-checkout`, `offers`
- buyer home, browse, listing detail, saved listings/sellers (126–127), cart/checkout, order track (131),
  make-offer, reviews, profile, KYC.

## Worker / labour (≈25) — ⬜  `src/features/labour-worker`, `labour-farmer`
- job offers (141), browse/my jobs, active job, claim/dispute, earnings, withdraw, insurance, skills, profile;
  farmer-side booking flow (book worker steps, booking detail).

## Vyapari / trader (subset of buyer + auctions ≈5) — ⬜  `src/features/auctions`, `vyapari-home`
- auction list/detail, place-bid, my-bids, outbid alert, create-auction, market dashboard, requirements inbox,
  supplier shortlist.

## FPO / Business owner — tenant-admin-lite (≈28 tenant screens) — ⬜  `src/features/tenant-admin-lite`
- tenant dashboard, today's orders, approvals queue, dispute detail (156), commissions, reports, branding,
  staff — mobile-lite subset (full console is `apps/web-tenant`).

## Village ambassador (≈19) — ⬜  `src/features/ambassador`
- ambassador home, onboard-farmer flow, assisted-consent, visit-log (164), commissions, leaderboard, AEPS/UPI
  withdraw, kiosk mode, training videos, goal-setting.

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
- Global search (183), settings, privacy, data download, about → `src/features/profile`, `settings`

## Cross-cutting infrastructure still to wire (folders present as documented placeholders)
- ✅ `core/voice` — on-device STT for the Speak-to-Sell flow (locale map + dictation hook + VoiceButton wired into
  create-listing, behind `voice_listing`). Pending: server LLM extraction of crop/qty/price; TTS.
- `core/push` — FCM registration + notification routing.
- `core/location` — GPS + geofence (delivery, mandi proximity).
- `core/offline/sqlite` + `sync.engine` — durable read cache + bidirectional sync (the write queue is built).

Each vertical follows the pattern shipped here: a `features/<area>` data layer on the SDK (degrade-never-die,
idempotent mutations, offline-queue for writes), screens under `src/app/(role)/…`, money via `MoneyText`
(bigint minor), i18n keys (not literals), and unit tests for any non-trivial pure logic.
