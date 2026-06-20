# MOBILE BUILD ROADMAP — Krishi-Verse App (prioritized, one command per item)

**How to use this file.** Each **P-## item below is one "AI_AGENT_BUILD" command = one session = one vertical
slice.** Issue them to the agent **in order** (top to bottom). With every mobile command, **attach
`MOBILE_AI_AGENT_BUILD_GUIDE.md`** (the mobile constitution) — this roadmap says *what* to build next; that guide
says *how* (hyperscale, global-attacker security, MNC release protocol). The backend guide
`AI_AGENT_BUILD_GUIDE.md` + `CLAUDE.md` 12 Laws remain supreme.

**Why this order.** Priority follows the PRD Phase-1 plan (`Seprate documents/01_Phase1_Lean_Scope.docx`,
`02_Phase1_Backlog.docx`): the **6 Phase-1 modules** (Auth/Profile, Catalogue/Listing, Bidding/Direct-Sale,
Wallet/Escrow/Payment, Order/Delivery, Labour-basic) for the **5 roles** (Farmer, Vyapari/Trader, Customer,
Tenant-Admin, Village-Ambassador), in **3 languages** (hi/en/gu). Within that, we sequence by the **money loop**:
a farmer must be able to *list → get discovered → sell → get paid*, and a buyer must *discover → buy → pay →
receive*. Everything that unblocks the next paid transaction comes first; value-adds (weather, tips, schemes)
and admin-lite come later; security-hardening + store release is the final gate before GA.

**Definitions.** P0 = launch blocker, P1 = must-have for GA, P2 = fast-follow, P3 = backlog. Each item names the
screens (from `SCREENS_BACKLOG.md` / `../../Phase-1 all screen design`), the backend module the contract comes
from (all 33 API modules already exist), the SDK work, scope, and the Definition of Done. Every item ships behind
a **feature flag (default OFF)** with i18n in all 3 languages, money as bigint-minor, idempotent writes, and the
loading/empty/error states — per the mobile guide.

---

## ✅ WAVE 0 — DONE (foundation + first vertical)
- Shared `packages/ui-native` (theme + 10 primitives), app `core/*` (config, api client, **offline-queue**,
  **session.reducer**, secure token store, auth store, i18n hi/en/gu, otp/role helpers) — unit-tested.
- Onboarding/auth **screens 01–05** (welcome/language/OTP/role/profile).
- Farmer tabs + **home (09)**, **my-listings (12)**, **create-listing (10) [text-only]**, **listing-detail
  (112)**, orders/wallet/profile stubs-made-real.
- Verified: 29 unit tests green, TSX syntax-clean, sdk/i18n/tokens green.

---

## WAVE 1 — Core platform infra the rest depends on (build FIRST)

These are cross-cutting capabilities almost every later screen needs. Do them before the verticals that use them.

### P-01 · Media capture & upload core (P0) — *infra* — ✅ DONE
- Built: SDK `media` resource; `core/media` (picker JIT-perms → compress/resize+EXIF-drop → pure SHA-256 →
  presigned S3 PUT with progress+retry → confirm); offline-first via shared dispatched queue
  (`core/offline/sync-queue`, idempotent replay); ui-native `UploadTile`/`AddMediaTile`/`ProgressBar`. 47 mobile
  unit tests green (incl. SHA-256 FIPS vectors), sdk 7/7; threats note in README. (Screen wiring lands in P-05.)
- **Why first:** create-listing photos, KYC docs, PoD photos, profile photo, chat images all need it.
- **Backend:** `media` module (S3 presign + EXIF-strip already built). **SDK:** add `media` resource
  (`presignUpload`, confirm) to `@krishi-verse/sdk-js`.
- **Build:** `core/media/` — pick from camera/gallery (`expo-image-picker`), client-side **downscale/compress**
  (rural data), EXIF strip, presigned multipart upload with progress + retry + offline-queue, thumbnailing;
  `ui-native` `ImagePicker`/`UploadTile` primitives.
- **DoD:** a photo captured → compressed → uploaded → media id returned; offline → queued; cancel/retry works.

### P-02 · Connectivity + offline read-cache + sync engine (P0) — *infra* — ✅ DONE
- Built: `core/offline/cache-policies` (pure, user-scoped keys + TTL/SWR) + `cache` (read-through SWR, injected
  store+clock) + `sqlite.db` (expo-sqlite store) + `scope` (per-user, cleared on sign-out); `core/connectivity`
  (NetInfo store + hook); `sync.engine` (flush queue on offline→online edge + foreground, concurrent-guarded);
  ui-native `OfflineBanner`; farmer home/listings/orders reads routed through cache (wallet left live). 70 mobile
  unit tests green (cache policies, SWR engine, sync guards). Threats note in README.
- **Why:** "degrade-never-die" + offline-first promise; every list/detail benefits.
- **Build:** `core/offline/sqlite.db.ts` (durable read cache), `cache-policies.ts` (stale-while-revalidate, TTL,
  tenant-prefixed keys, invalidation), `sync.engine.ts` (flush the write OfflineQueue + revalidate on
  reconnect/foreground), NetInfo-based connectivity banner. Wire the existing `OfflineQueue.flush` loop.
- **DoD:** app usable airplane-mode (cached reads); a queued create replays on reconnect (same idempotency key);
  no duplicate on double-flush (unit-tested).

### P-03 · Payments (Razorpay) + KYC core (P0) — *infra + Module 4/1* — ✅ DONE (with flagged gaps)
- Built: SDK `payments`/`payouts`/`kyc`/`bankAccounts` resources; `core/payments` (Razorpay checkout boundary +
  pure money/status helpers); `core/security/useSecureScreen` (FLAG_SECURE); `features/payments.addMoney`
  (intent→checkout→poll, webhook-verified server-side, idempotent) + `features/kyc` (status list + submit/bank
  contracts). Screens: add-money (20) + KYC status (109/175), FLAG_SECURE, flag-gated (payments_addmoney/kyc).
  77 mobile unit tests green; threats note in README.
- **Flagged (not faked):** wallet-balance read-model + KYC doc-type lookup + bank vaultRef tokenisation are
  unbuilt API endpoints → status/balance degrade; bank-ADD + withdraw + Aadhaar-eKYC deferred (P-06 / Phase-2).
- **Why:** wallet add-money, checkout, payouts, worker wages, EMD all depend on it; payouts need KYC/bank.
- **Backend:** `payments` + `wallet-service`; `identity` KYC. **SDK:** add `wallet` + `payments` resources
  (balance, add-money intent, verify, txns, withdraw) and `kyc` (aadhaar start/otp, bank, selfie, doc upload).
- **Build:** `core/payments/` Razorpay checkout (UPI/cards/netbanking) with verification handled server-side;
  `features/kyc/` screens **72,73,173,174,175,74,133** (Aadhaar start/OTP, selfie, doc upload, rejected, bank
  setup, buyer KYC). **FLAG_SECURE** on all KYC/payment screens; never store raw Aadhaar/PAN/bank.
- **DoD:** a ₹ add-money completes end-to-end on staging; bank/KYC submitted + status reflects; PII masked; zero
  secrets in bundle.

### P-04 · Push notifications + in-app notification center (P0/P1) — *infra + Module 5* — ✅ DONE (token-sync flagged)
- Built: SDK `notifications` resource (inbox/mark-read/prefs/quiet-hours); `core/push` (fcm register+token, pure
  notification-router with off-app deep-link guard, pure quiet-hours, foreground+tap listeners); ui-native
  `Toggle`; screens inbox (28/191) + detail (172) + settings (171), bell on home; flag `notifications` OFF.
  88 mobile unit tests green; threats note in README.
- **Flagged (not faked):** no client device-token registration endpoint yet → `syncPushToken` degrades until the
  `communication` module exposes one; the in-app center is fully real.
- **Why:** order status (PRD DoD: pushed <30s), auction outbid, wage events, OTP.
- **Backend:** `communication` module. **SDK:** add `notifications` resource (list, mark-read, prefs).
- **Build:** `core/push/` (FCM register, token sync, `notification-router.ts` deep-link routing, quiet hours),
  screens **28,171,172,191,192** (notifications list, settings, detail, inbox-all, archive).
- **DoD:** a server event arrives as a push + lands in the inbox; tapping deep-links to the right screen;
  prefs/quiet-hours respected; token never logged.

---

## WAVE 2 — Farmer sell-&-get-paid loop (P0, Modules 2/3/4/5)

### P-05 · Listing photos + voice + manage (P0) — *Module 2/3* — ✅ DONE (LLM-extract + boost/analytics flagged)
- **Screens:** **10 create-listing (photo+voice), 11 preview, 113 edit (price), 112 detail (Edit/Repost/Boost),
  116 repost (via `?repostFrom`).** **Backend:** `listings` + `catalogue` + `media`.
- **Build:** upgraded create-listing with photos (P-01 media: compress + presigned PUT, per-tile progress/retry/
  queue) and **voice listing** (`core/voice` on-device STT, 3 languages via pure `sttLocaleFor`, `useVoiceDictation`
  hook + `VoiceButton`); preview→publish (real); price edit with optimistic `version` concurrency (real PATCH);
  repost prefill→create (real). SDK gained owner methods (`getOwn/create/publish/changePrice/startBoost`).
- **Shipped real:** photo+voice create → preview → publish; price edit; repost. **Flagged (built contract, not
  faked):** voice→**LLM crop/qty/price extraction** has no server AI endpoint → voice fills FREE TEXT only (never
  auto-parse money/qty); **boost** is a real wallet-debit→txnId paid action but tier-price + debit route aren't
  wired → behind `listing_boost` (OFF) the button honestly says "coming soon", not a cosmetic flag; full-field edit,
  listing **analytics (115)**, and a dedicated repost endpoint have no API yet.
- **DoD:** photo listing <60s ✅; voice → structured draft <90s (free-text path; LLM-extract pending endpoint);
  edit/repost work ✅; boost stays a real (flagged) paid action via wallet — no fake spend ✅.
- **Verify:** mobile **91 unit tests green** (incl. new `sttLocaleFor` spec), sdk 7/7, 0 syntax errors, 0 broken
  imports, 0 direct `apiClient()` in screens, hi/en/gu locales valid (141 keys each); threats note in README.

### P-06 · Farmer wallet + transactions + payouts (P0) — *Module 4*
- **Screens:** **19 wallet-home, 20 add-money, 21 transactions, 70 withdraw, 71 txn-detail, 58 earnings,
  59 payout-history, 180 UPI mgmt, 181 autopay, 182 spending-insights.** **Backend:** `wallet-service`/`payments`.
- **Build:** full wallet vertical on P-03; bigint-minor everywhere via MoneyText; withdraw → RazorpayX payout
  (needs KYC/bank); reconciled balances shown read-only.
- **DoD:** balance == ledger (server truth) shown; add-money + withdraw flows complete; txn list keyset-paged;
  earnings/payout history correct.

### P-07 · Farmer orders + delivery + PoD (P0) — *Module 5*
- **Screens:** **56 farmer-orders, 57 order-detail, 22 my-orders, 23 order-detail, 24 review, 131 order-track,
  135 report-order.** **Backend:** `orders` + `logistics` + `reviews`.
- **Build:** order lifecycle (created→confirmed→in-transit→delivered→completed), self-pickup, **PoD via OTP +
  photo** (PRD DoD), status tracking, review-after-complete. **SDK:** add `orders` resource.
- **DoD:** status change reflects <30s (with push P-04); PoD captured before "delivered"; completion triggers
  payout server-side; degrade-never-die on every state.

---

## WAVE 3 — Buyer / Customer purchase loop (P0/P1, Modules 2/3/5)

### P-08 · Buyer browse + search + listing detail (P0) — *Module 2*
- **Screens:** **13 buyer-home, 67 search-results, 68 filters, 14 listing-detail, 100 seller-profile,
  126 saved-listings, 127 saved-sellers, 128 saved-searches.** **Backend:** `listings`/`catalogue` (+ OpenSearch).
- **Build:** `(buyer)` tab group; SDK `listings.browse` + search; keyset paging; save/follow; seller profile.
- **DoD:** search results <2s on 3G via cache; filters work; listing detail with media gallery; saves persist.

### P-09 · Buyer cart → checkout → order (P0) — *Module 3/4/5*
- **Screens:** **96 cart, 15 checkout, 129 delivery-address, 130 payment-method, 134 addresses, 22/69 orders,
  131 track, 132 buyer-profile, 133 buyer-kyc.** **Backend:** `orders` + `payments` + `promotions`.
- **Build:** cart, address book, checkout totals (charges/discounts from server), pay via P-03, place order
  (idempotent), order tracking. Direct-sale order placement <4s (PRD DoD).
- **DoD:** end-to-end buy on staging (escrow held); idempotent checkout; coupon applies server-side; degrade paths.

### P-10 · Offers / inquiry / chat (P1) — *Module 3 + messaging*
- **Screens:** **97 inquiry, 98 chat, 99 make-offer.** **Backend:** `offers` + `communication` messaging
  (masked calls). **SDK:** add `offers` + `messaging` resources.
- **Build:** make/accept/counter offer (→ order on accept), buyer↔seller chat (text + image via P-01), masked
  call launch. **No PII leak** (numbers masked server-side).
- **DoD:** offer accepted → order created; chat realtime-ish (poll or socket); attachments via media core.

---

## WAVE 4 — Auctions (P1, Module 3)

### P-11 · Auction discovery + bidding + live (P1)
- **Screens:** **16 auction-detail, 17 place-bid, 18 my-bids, 64 create-auction, 65 watch-live, 66 ended,
  193 outbid, 194 history.** **Backend:** `auctions` (EMD via wallet). **SDK:** add `auctions` resource.
- **Build:** browse/detail, place bid with **EMD hold** (wallet), live updates (socket/poll), outbid push
  (P-04), create-auction (seller), close→winner→settlement (server), EMD refund on loss.
- **DoD:** test auction completes, winner declared, **losing EMD refunded** (PRD DoD); bids idempotent; live
  refresh degrades to poll.

---

## WAVE 5 — Labour marketplace (P1, Module 6 — the differentiator)

### P-12 · Worker app: onboarding + jobs (P1)
- **Screens:** **29 worker-home, 30 browse-jobs, 31 job-detail, 140 apply, 141 job-offer, 142 decline,
  136 edit-profile, 137 add-skill, 138 work-history, 139 documents, 38 profile-own, 36 availability, 37 skills.**
- **Backend:** `labour`. **SDK:** add `labour` resource. Onboarding is **Ambassador-led only**, **hard 18+
  Aadhaar** (P-03 KYC).
- **DoD:** worker onboarded (by ambassador flow) in <10 min; accept/decline within 4h window enforced server-side.

### P-13 · Worker active job: geo-attendance + wage payout + insurance (P1)
- **Screens:** **33 active-job, 32 my-jobs, 34 payment-received, 35 earnings, 41 withdraw, 40 reviews,
  39 insurance, 145 PMSBY-enroll, 146 claim, 143 dispute, 144 help.** **Backend:** `labour` + `wallet` + `fintech`(insurance).
- **Build:** **geo-fenced clock-in (within 100m, `core/location`)**, attendance, **direct UPI wage on EOD**
  (PRD DoD: within 2h), **minimum-wage hard-floor** (server-enforced; UI shows rejection), PMSBY auto-attach +
  claim.
- **DoD:** clock-in blocked outside 100m; wage paid within 2h of EOD on staging; below-min-wage post rejected.

### P-14 · Farmer-side labour booking (P1)
- **Screens:** **25 worker-profile, 42 browse-workers, 43 filter, 26 book-worker, 44/45/62/46/63 book-steps,
  27/47 booking-confirm/sent, 48 accepted, 49 rejected, 50 my-bookings, 51 booking-detail.** **Backend:** `labour`.
- **DoD:** daily-wage booking confirmed by worker within 4h; booking lifecycle complete; degrade paths.

---

## WAVE 6 — Village Ambassador (P1 — drives farmer acquisition, PRD Month 4)

### P-15 · Ambassador home + farmer onboarding flow (P1)
- **Screens:** **86 home, 87 farmers, 88 onboard-start, 89 onboard-scan, 90 onboard-verify, 91 complete,
  162 help-listing, 163 help-order, 164 visit-log.** **Backend:** `ambassadors` + `identity`.
- **Build:** assisted onboarding (scan farmer docs via P-01, OTP-consent, create farmer account), assisted
  listing/order, visit log (geo). **SDK:** add `ambassadors` resource.
- **DoD:** ambassador onboards a farmer end-to-end; commission attribution recorded server-side.

### P-16 · Ambassador earnings + training + targets (P1)
- **Screens:** **92 commissions, 168 withdraw, 93 leaderboard, 169 targets, 170 goal-setting, 94 training,
  165 video-player, 166 quiz, 167 faq, 95 profile.** **Backend:** `ambassadors` + `education`.
- **DoD:** commission ledger correct (bigint-minor); withdraw via payout; training video + quiz complete.

---

## WAVE 7 — Tenant-Admin-lite (mobile) (P2 — full console is `apps/web-tenant`)

### P-17 · Tenant mobile dashboard + approvals + ops-lite (P2)
- **Screens:** **08 dashboard, 06 apply, 07 pending, 76 farmers, 77 farmer-detail, 78 add-farmer,
  147 approvals, 148 approve-detail, 155 disputes, 156 dispute-detail, 79 listings, 80 payouts.**
- **Backend:** `tenancy` + relevant modules. **Mobile-lite** = monitoring + approvals on the go; heavy admin
  stays on web. **SDK:** reuse where possible.
- **DoD:** tenant can approve a farmer + view KPIs + action a dispute from mobile; no god-mode (Law 11).

### P-18 · Tenant analytics + broadcast + settings-lite (P2)
- **Screens:** **84 kpi-gmv, 150/151/152 analytics, 153 custom-report, 154 export, 157 broadcast, 158 campaigns,
  159 payment-settings, 160 notifications, 161 integrations, 81 compliance, 82 branding, 83 team, 85 billing,
  149 bulk-actions.** **DoD:** core 15 reports viewable; broadcast send works; heavy editing deep-links to web.

---

## WAVE 8 — Farmer value-added services (P2, Modules from PRD beyond core)

### P-19 · Mandi prices + weather (P2)
- **Screens:** **52 mandi-prices, 53 mandi-detail, 110 mandi-alerts, 111 mandi-history, 54 weather,
  117 weather-detail, 118 weather-settings.** **Backend:** `market-intel` + `land-soil-weather`. **SDK:** add
  `market-intel` resource. **DoD:** live mandi pulse + price alerts (push); weather by location.

### P-20 · Tips + crop hub + AI assistant (P2)
- **Screens:** **55 tips-library, 101 tip-detail, 102 category, 103 saved-tips, 104 crop-hub, 125 AI-chat,
  184 voice-search.** **Backend:** `education`/`cms` + AI. **DoD:** tips browsable offline; AI chat answers in 3
  languages; voice search works.

### P-21 · Schemes (govt) (P2)
- **Screens:** **60 schemes, 105 detail, 106 apply, 107 status, 108 docs, 109 my-schemes.** **Backend:**
  `schemes`. **SDK:** add `schemes` resource. **DoD:** eligibility shown, apply + doc upload (P-01), status
  tracked.

### P-22 · Farmer profile / farm / bank / docs + help (P2)
- **Screens:** **61 profile-own, 119 edit-profile, 120 farm-details, 121 bank-accounts, 122 documents,
  123 help, 124 complaint.** **Backend:** `identity` + `support` + `land-soil-weather`(parcels). **DoD:** profile
  CRUD; bank add (KYC); support ticket (→ `support` module) with SLA.

---

## WAVE 9 — Cross-cutting screens + search (P2/P3)

### P-23 · Global search + settings + system screens (P2)
- **Screens:** **183 global-search, 75 settings, 187 language-switcher, 178 privacy, 179 data-download,
  177 account-delete, 176 change-phone, 185 permissions, 186 tutorial, 188 offline, 189 server-error,
  190 app-update, 196 about, 195 feedback.** **Backend:** search + `identity` (DPDP export/delete).
- **DoD:** global search across listings/orders/etc.; **DPDP data export + account delete** flows; forced-update
  screen; offline/error screens wired as the global fallbacks.

---

## WAVE 10 — Adjacent role apps (P3 — only if Phase-1 includes them; per PRD these are Phase-2 roles)

> Per `01_Phase1_Lean_Scope`, Pashupalak/Dairy/Vet/Equipment/Store/Delivery-partner are **Phase 2 roles**. Their
> feature folders exist (`dairy`, `mcc-operator`, `livestock`, `vet`, `delivery-partner`, `store-owner`,
> `fintech`, `vyapari-home`, `fpo-coordinator`) and the backend modules are built, but **do NOT build these for
> Phase-1 GA** unless explicitly re-scoped. Listed here so the backlog is complete.
- **P-24** Dairy / MCC operator (milk diary, MCC slip, bill, D2C).
- **P-25** Livestock + Vet (animal records, health, vet booking).
- **P-26** Delivery partner (tasks, route, pickup OTP, PoD, earnings).
- **P-27** Store owner (inventory, orders, batches/expiry, licence).
- **P-28** Fintech (loan products/apply, credit score, insurance) — buyer/farmer-facing.
- **P-29** Vyapari/FPO extras (market dashboard, requirements inbox, supplier shortlist, group lots).

---

## WAVE 11 — Hardening + store release (P0 GATE before GA, PRD S17–S18)

### P-30 · Security hardening pass (P0)
- TLS **certificate/public-key pinning**; **root/jailbreak + Play Integrity/App Attest** on login/pay/KYC/payout;
  release **obfuscation** (Hermes, R8/ProGuard, strip+privately-upload source maps, no dev menu); **FLAG_SECURE**
  audit on all sensitive screens; clipboard/deep-link/WebView audit; `npm audit`/Snyk clean; pen-test the OTP,
  checkout, payout, attendance, and offer flows from a patched-client perspective. **DoD:** the §4 checklist of
  `MOBILE_AI_AGENT_BUILD_GUIDE.md` fully green + a written threat-model sign-off.

### P-31 · Observability + crash + analytics (P0)
- Sentry (PII/token-redacted, symbolicated), analytics funnels (consented, offline-buffered), client SLO
  dashboards (crash-free ≥99.5%, login/listing/checkout success), correlation-id propagation. **DoD:** a forced
  crash is captured + symbolicated; key funnels emit; no PII in any payload.

### P-32 · Release pipeline + store compliance (P0)
- EAS build profiles (dev/preview/prod), **phased rollout** (1%→10%→100%) with crash gates, **OTA** (expo-updates)
  with flag discipline + rollback, forced-update floor, Play/App Store data-safety + permission justifications +
  privacy policy, beta channels. **DoD:** a signed build ships to internal track; OTA + rollback rehearsed;
  store metadata complete; e2e (Detox/Maestro) green on the critical sell+buy+pay path.

---

## Cross-cutting rules for EVERY item (from `MOBILE_AI_AGENT_BUILD_GUIDE.md`)
- Server is the only security authority; the app never trusts its own role for anything but navigation.
- Money = bigint minor-unit strings + `MoneyText` (Law 2). Every mutation carries an Idempotency-Key (Law 3).
- Degrade-never-die: loading/empty/error states wired; timeout on every call; reads cached, writes queued.
- i18n keys in hi/en/gu for every string; ≥48px targets + a11y labels; tokens-only styling.
- Behind a feature flag (default OFF) with a kill-switch; unit-test pure logic; update `SCREENS_BACKLOG.md` +
  `MODULE_STATUS.md`; ship a feature README + "Threats considered" note; paste green typecheck/test output.

## SDK work implied (extend `@krishi-verse/sdk-js` as each vertical lands)
New typed resources to add (currently only auth/listings/catalogue/traceability exist): **media, wallet,
payments, kyc, orders, offers, messaging, auctions, labour, ambassadors, notifications, market-intel, schemes,
reviews, support, tenancy**. Add the resource + types in the same session as the screen that first needs it (or
use the SDK `request()` escape-hatch and note the assumed contract) — never fake a response.
```
