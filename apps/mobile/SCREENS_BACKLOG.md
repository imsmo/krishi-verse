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

## Worker / labour (≈25) — ⬜  `src/features/labour-worker`, `labour-farmer`
- job offers (141), browse/my jobs, active job, claim/dispute, earnings, withdraw, insurance, skills, profile;
  farmer-side booking flow (book worker steps, booking detail).

## Auctions (P-11) — 🟢  `src/features/auctions` (behind `auctions`)
- ✅ 16 auction-detail (+65 watch-live 4s poll, 66 ended, 193 outbid banner, 194 bid history), 17 place-bid (EMD
  held server-side), 64 create-auction (seller, from a listing) → `(buyer)/auctions/*` + `(farmer)/create-auction`.
  SDK `auctions`. Flagged: EMD amount not in read model (shown as note); 18 my-bids cross-auction (no endpoint,
  own bids marked inline); live = poll not socket.

## Vyapari / trader (subset of buyer + auctions ≈5) — 🟡 (auctions shared via P-11)  `src/features/auctions`, `vyapari-home`
- ✅ auctions reuse P-11 (`src/features/auctions`). ⬜ market dashboard, requirements inbox, supplier shortlist,
  vyapari-home.

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
