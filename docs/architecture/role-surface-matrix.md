# Role → Surface Matrix — all 24 PRD roles (coverage proof)

Every role from PRD §4.1 mapped to its app, its place in the repo, and its key screens/routes.

| # | PRD Role | Surface (app) | Where in the repo | Key screens / routes |
|---|----------|---------------|-------------------|----------------------|
| 1 | Super Admin / SaaS Owner | **GOD MODE** — separate backend + panel | `apps/admin-api/src/modules/*` + `apps/web-admin/src/app/*` | tenant-ops, impersonate, plans, flags kill-switch, billing (MRR/dunning), recon-monitor, compliance/dsr-queue, cells |
| 2 | Tenant Owner / Tenant Admin | Tenant panel + mobile lite | `apps/web-tenant/src/app/*` + `apps/mobile/src/features/tenant-admin-lite/` | dashboard, users, kyc-queue, listings/moderation, orders, wallet, payouts, commission-rules, reports, settings/* |
| 3 | Tenant Staff (scoped) | Tenant panel | `apps/web-tenant` + `settings/staff-permissions` route + `staff_permission_overrides` table | same panel, permission-scoped |
| 4 | Customer / Consumer | Mobile + storefront | `apps/mobile/src/features/buyer-browse, buyer-checkout` + `apps/web-storefront` | BuyerHome(13), ListingDetail(14), Checkout(15), SavedListings(126), SavedSearches(128) |
| 5 | Farmer / Vendor | Mobile | `apps/mobile/src/features/farmer-home, listings-create, listings-manage, orders, wallet` | FarmerHome(09), CreateListing(10), MyListings(12), MandiPrices(52), Earnings(58) |
| 6 | Vyapari / Market Person | Mobile | `apps/mobile/src/features/vyapari-home, auctions, offers` | VyapariHome, RequirementsInbox, MarketDashboard, MyBids(18) |
| 7 | Pharma / Agri-Input Store | Mobile | `apps/mobile/src/features/store-owner` | StoreInventory, BatchesExpiry, StoreOrders, LicenceRenewal |
| 8 | Organic Store / Certified Producer | Mobile | `apps/mobile/src/features/store-owner` + certificates module | + certificate upload/renewal flows |
| 9 | Delivery Partner / Logistics | Mobile | `apps/mobile/src/features/delivery-partner` | TasksToday, RouteMap, PickupOtp, DeliveryPod, Earnings |
| 10 | Education Instructor | Tenant panel + mobile | `apps/web-tenant` (courses) + `apps/api/src/modules/education` | course builder, learner analytics, royalties |
| 11 | Support Agent | Tenant panel | `apps/web-tenant/src/app/support-inbox` | ticket queue, SLA timers, escalation |
| 12 | Auditor / Accountant | Tenant panel (read-only) | `apps/web-tenant/src/app/auditor` | ledger explorer, settlements, GST/TDS exports |
| 13 | Village Ambassador | Mobile (+ kiosk mode) | `apps/mobile/src/features/ambassador` | AmbassadorHome(86), KioskMode, OnboardFarmerFlow(88-90), Commissions(92), AepsWithdraw |
| 14 | FPO Coordinator | Mobile + tenant panel | `apps/mobile/src/features/fpo-coordinator` + `web-tenant/group-lots` | GroupLots, MemberPledges, GroupSettlement, Members |
| 15 | AI Operations Officer | Panels | `apps/web-tenant/src/app/ai-review-queue` + `apps/web-admin/src/app/ai-review-queue` | low-confidence grades, fraud flags, model dashboards |
| 16 | Pashupalak / Livestock Farmer | Mobile | `apps/mobile/src/features/livestock` [P2] | AnimalList, AnimalDetail, VetBooking, HealthRecord |
| 17 | Dairy Farmer / MCC Operator | Mobile | `apps/mobile/src/features/dairy` + `features/mcc-operator` [P2] | MilkDiary, MilkBill, CollectionSlip (<8 taps), BmcStatus, ShiftClose |
| 18 | Veterinarian / AI Inseminator | Mobile | `apps/mobile/src/features/vet` [P2] | BookingsCalendar, PrescriptionWriter, Earnings |
| 19 | Banker / NBFC Loan Officer | **Partner portal** | `apps/web-partner/src/app/loan-queue, disbursals, portfolio` [P2] | application decisioning, disbursal tracking, SLA report |
| 20 | Insurance Agent / Surveyor | **Partner portal** | `apps/web-partner/src/app/claims-queue, policies` [P2] | claim survey/decide, policy book |
| 21 | Equipment Owner / CHC Operator | Mobile | `apps/api/src/modules/equipment` + mobile equipment feature [P2] | fleet, bookings calendar, earnings |
| 22 | Government Officer / Scheme Operator | Tenant panel (government tenant) | `apps/web-tenant/src/app/schemes/applications` [P2] | application verification, DBT dashboards |
| 23 | Agricultural Worker | Mobile | `apps/mobile/src/features/labour-worker` | WorkerProfile(25), BrowseJobs(30), ActiveJob(33), Earnings(35), Insurance(39) |
| 24 | Sardar / Mukadam | Mobile | `apps/api/src/modules/labour` (crews/sardars) + mobile labour [P2] | crew roster, crew bookings, transparent wage distribution |

**Channels beyond apps** (PRD §6.1): IVR/USSD feature-phone users → `apps/ivr-ussd-gateway`; WhatsApp commerce → `apps/whatsapp-bot`; SMS/push → `apps/worker/src/jobs/notifications`.

**How to read this with FILE_MANIFEST.md:** this matrix tells you *which folder serves which human*; the manifest lists every file inside those folders with its purpose and phase.
