// @krishi-verse/sdk-js · response types mirroring the API read-models. MONEY IS ALWAYS A STRING of bigint minor
// units (Law 2) — never a JS number, so a large balance/price never loses precision in a browser.
export interface Page<T> { items: T[]; nextCursor: string | null; total?: number | null; }

// --- lookups / taxonomy (P1-9) — reference data for rendering pickers/facets with REAL names. ---
/** A global taxonomy node (category tree). `defaultName` is the canonical label; server-side reads of name-resolved
 * surfaces may localize elsewhere. `path` (ltree) + `depth` give the tree shape. */
export interface CategoryNode {
  id: string; parentId: string | null; code: string; defaultName: string; path: string; depth: number;
  commerceKind: string; requiresLicense: boolean; requiresCertificate: boolean; minAge: number | null;
  isActive: boolean; sortOrder: number;
}
/** One option for a dropdown/select attribute (e.g. a "Variety" value). */
export interface AttributeOption { id: string; attributeId: string; code: string; defaultName: string; sortOrder: number; isActive: boolean; }
/** An attribute definition bound to a category, with its options + per-binding flags (filterable/card/required). */
export interface AttributeDef {
  id: string; code: string; defaultName: string; dataType: string; unitCode: string | null;
  required: boolean; showInFilters: boolean; showOnCard: boolean; options: AttributeOption[];
  [k: string]: unknown;
}
/** A controlled-vocabulary value (e.g. a doc_type), LOCALE-RESOLVED server-side: `name` is in the caller's language
 * when a translation exists, else the canonical default. */
export interface LookupValue { id: string; code: string; name: string; sortOrder: number; meta: Record<string, unknown>; }
/** An admin-region node (state→district→…), LOCALE-RESOLVED `name`. `lat`/`lng` are the centroid when known. */
export interface RegionNode { id: string; code: string | null; level: number; parentId: string | null; name: string; lat: number | null; lng: number | null; }

export interface ListingCard {
  id: string; title: string; priceMinor: string; currencyCode: string; unitCode: string;
  quantityAvailable: number; organicClaim: boolean; saleType: string; regionId: string | null;
  sellerUserId: string; boosted: boolean;
  /** Present on owner/detail reads (optimistic-concurrency token for price edits). */
  version?: number;
  status?: string;
  /** Detail-read (GET listings/:id) NON-PII public links. `null` = none for this listing; `undefined` on list reads.
   *  qrToken → /trace/:qrToken provenance page; auctionId/status/endsAt → the live auction. */
  qrToken?: string | null;
  auctionId?: string | null;
  auctionStatus?: string | null;
  auctionEndsAt?: string | null;
}
export interface ListingQuery {
  q?: string; categoryId?: string; regionId?: string; saleType?: string; organic?: boolean;
  priceMinMinor?: string; priceMaxMinor?: string; sort?: 'newest' | 'price_asc' | 'price_desc'; cursor?: string; limit?: number;
}
export interface ProductCard { id: string; name: string; categoryId: string; defaultUnit: string; brandId: string | null; gstRatePct: number | null; isPerishable: boolean; isPlatform: boolean; }

/** A selectable paid-boost tier (price + days are server truth, from the seeded lookup meta). Money minor-unit string. */
export interface BoostTier { id: string; code: string; name: string; priceMinor: string; days: number; }
/** Result of paying for a boost from the wallet (server-resolved price; boost recorded immediately). */
export interface BoostWalletPayResult { ok: boolean; boostId: string; endsAt: string; priceMinor: string; days: number; txnId: string; }
/** A seller's own-listing engagement analytics. Real metrics only (no fabricated impression/view count). */
export interface ListingAnalytics {
  listingId: string; status: string; publishedAt: string | null;
  offers: number; priceChanges: number; boostsPurchased: number; activeBoost: { endsAt: string } | null;
}

// --- buyer favourites (module: buyer) ---
export type SavedEntityType = 'listing' | 'product' | 'seller' | 'worker' | 'course' | 'tip';
/** A buyer's saved item (polymorphic favourite). */
export interface SavedItem { id: string; entityType: SavedEntityType; entityId: string; createdAt: string; }
/** A buyer's saved search (re-runnable filter set). */
export interface SavedSearch { id: string; name: string; query: Record<string, unknown>; notifyNewMatches: boolean; createdAt: string; }

// --- public seller profile + listing gallery (discovery) ---
/** Public seller storefront: SAFE fields + reputation only (NO phone/email/KYC). */
export interface SellerPublicProfile {
  sellerId: string; displayName: string | null; regionId: string | null; memberSince: string | null;
  rating: { count: number; avgStars: number }; listingsActive: number;
}
/** One signed gallery image for a public listing (short-lived presigned GET url). */
export interface GalleryItem { mediaId: string; url: string; sortOrder: number; }

/** Public farm-to-fork provenance (from the SECURITY DEFINER trace_scan projection — NON-PII). */
export interface TraceProvenance {
  qrToken: string; listingId: string | null; declaredInputs: unknown[]; certificateIds: unknown[];
  anchored: boolean; createdAt: string; events: Array<{ eventCode: string; meta: Record<string, unknown>; at: string }>;
}

export interface AuthTokens { accessToken: string; refreshToken: string; expiresInSec: number; }
export interface UserProfile { id: string; displayName: string | null; roles: string[]; locale: string; }

// --- payments (module 4) — money is bigint minor-unit STRINGS (Law 2) ---
export type PaymentPurpose = 'wallet_recharge' | 'direct_order' | 'subscription' | 'boost' | 'emd' | 'course';
/** Returned by createIntent — feed gatewayOrderId into the gateway SDK (Razorpay), then poll status. */
export interface PaymentIntent { paymentId: string; gatewayOrderId: string; provider: string; amountMinor: string; status: string; }
export interface PaymentSummary { id: string; status: string; amountMinor: string; currencyCode: string; purpose?: string; createdAt?: string; }
/** A GST trade invoice for an order (totals minor-unit strings; tax split in taxBreakup). NON-PII. */
export interface InvoiceSummary { id: string; invoiceNo: string; orderId: string; sellerGstin: string | null; buyerGstin: string | null; totalMinor: string; taxBreakup: Record<string, unknown>; pdfMediaId: string | null; createdAt: string; }
/** A short-lived presigned PDF download URL for an invoice. */
export interface InvoiceDownload { invoiceNo: string; url: string; expiresInSec: number; }
export interface PayoutSummary { id: string; status: string; amountMinor: string; currencyCode: string; purpose?: string; createdAt?: string; }
/** Reconciled wallet balance (server-truth, bigint minor-unit strings). */
export interface WalletBalance { userId: string; currencyCode: string; availableMinor: string; heldMinor: string; isFrozen: boolean; }
/** One ledger entry in the caller's wallet statement. amountMinor is SIGNED (+credit / −debit). */
export interface WalletLedgerEntry { entryId: string; txnId: string; txnType: string | null; accountCode: string; amountMinor: string; balanceAfterMinor: string; currencyCode: string; referenceType: string | null; referenceId: string | null; description: string | null; createdAt: string; }
export interface BankAccount { id: string; accountKind: 'bank' | 'upi'; upiId?: string | null; accountLast4?: string | null; ifsc?: string | null; holderName?: string | null; isPrimary: boolean; }
/** A money-insights bucket: a month ('YYYY-MM') or a txn-type code, with the total (bigint minor-unit string). */
export interface InsightBucket { key: string; amountMinor: string; count: number; }
/** Aggregated earnings (credits) or spending (debits, positive magnitudes) over a bounded window. */
export interface WalletInsights { fromIso: string; toIso: string; currencyCode: string; totalMinor: string; byMonth: InsightBucket[]; byType: InsightBucket[]; }
/** A UPI AutoPay mandate (standing instruction). vpaMasked is "ab***@psp" — never the raw VPA. No money lives here. */
export interface AutopayMandate { id: string; status: 'pending' | 'active' | 'paused' | 'cancelled' | 'expired'; purpose: string; vpaMasked: string; provider: string; maxAmountMinor: string; currencyCode: string; frequency: string; validUntil: string | null; createdAt: string; }

// --- KYC (module 1, identity) — never carries raw doc numbers, only masked + media refs ---
export type KycStatus = 'pending' | 'verified' | 'rejected' | 'expired';
export interface KycDocument { id: string; status: KycStatus; docTypeId?: string; mediaId?: string; docNoMasked?: string | null; rejectReason?: string | null; createdAt?: string; }
/** A selectable KYC document type from the seeded 'doc_type' catalogue (id to submit + name to show). */
export interface KycDocType { id: string; code: string; name: string; }

// --- eKYC (Aadhaar/PAN provider verification). The server returns ONLY masked values — never the raw id. ---
export interface EkycStartResult { id: string; docType: 'aadhaar' | 'pan'; maskedId: string; otpRequired: boolean; }
export interface EkycVerifyResult { id: string; status: 'verified'; docType: 'aadhaar' | 'pan'; maskedId: string; nameMatch: boolean | null; }
export interface EkycSessionSummary { id: string; docType: 'aadhaar' | 'pan'; maskedId: string; status: 'pending' | 'verified' | 'failed' | 'expired'; nameMatch: boolean | null; }

// --- notifications (communication module) ---
/** An inbox notification. The rendered title/body/deepLink live in `payload` (server-rendered, localized);
 * `status` includes 'read' once acknowledged. */
export interface NotificationItem {
  id: string; eventCode: string; channel: string; status: string; languageCode?: string | null;
  payload: Record<string, unknown>; createdAt?: string; readAt?: string | null;
}
export interface NotificationPreference { eventCode: string; channel: string; isEnabled: boolean; }
export interface QuietHours { starts: string; ends: string; timezone: string; }

// --- orders (module 5) — money is bigint minor-unit STRINGS (Law 2) ---
/** One row in the buyer/seller order timeline (CQRS read-model). `counterparty` is the other party's userId. */
export interface OrderListItem { id: string; orderNo: string; status: string; totalMinor: string; counterparty: string | null; createdAt?: string; }
/** A line item on an order — snake_case mirrors the order_items read row; money fields are bigint strings. */
export interface OrderItemLine {
  listing_id: string; product_id: string | null; title_snapshot: string; quantity: number; delivered_quantity: number | null;
  unit_code: string; unit_price_minor: string; line_total_minor: string; gst_rate_pct: number | null; batch_id: string | null;
}
/** Full order detail (server-serialized). Every *Minor is a bigint string (Law 2). */
export interface OrderDetail {
  id: string; orderNo: string; status: string; source: string; buyerUserId: string; sellerUserId: string; currencyCode: string;
  subtotalMinor: string; deliveryFeeMinor: string; discountMinor: string; taxMinor: string; commissionMinor: string; totalMinor: string;
  acceptanceDeadline?: string | null; qualityWindowEnds?: string | null; createdAt?: string; completedAt?: string | null;
  items: OrderItemLine[];
}

// --- logistics (module 5) — shipment + proof-of-delivery ---
export interface Shipment {
  id: string; orderId: string; status: string; partnerId?: string | null; vehicleId?: string | null; riderUserId?: string | null;
  awbNo?: string | null; scheduledPickupAt?: string | null; pickedUpAt?: string | null; deliveredAt?: string | null;
  podMediaId?: string | null; requiresOtp: boolean; chargeMinor?: string | null;
}

// --- reviews (module 5) ---
export interface ReviewSummary { averageStars: number; count: number; }
/** One PUBLIC review (PII-free: no reviewer id / order id). Stars 1–5; optional body/sub-ratings/tags; the
 *  seller's public response if any. Dates are ISO strings. */
export interface PublicReview {
  id: string; stars: number; subRatings: Record<string, number>; body: string | null; tags: string[];
  isVerifiedPurchase: boolean; sellerResponse: string | null; sellerRespondedAt: string | null;
  helpfulCount: number; createdAt: string;
}
/** A review as seen by a party (the reviewed seller/buyer or its author) — includes ids for management. */
export interface ReviewItem extends PublicReview {
  orderId: string | null; reviewerUserId: string; targetType: string; targetId: string; status: string;
}

// --- cart + checkout (module 3) — money is bigint minor-unit STRINGS (Law 2) ---
export interface CartItem {
  listingId: string; title: string | null; quantity: number; unitPriceMinor: string; lineTotalMinor: string;
  priceChanged: boolean; available: number; purchasable: boolean;
}
export interface Cart { items: CartItem[]; subtotalMinor: string; }
/** Checkout converts the cart into one order per seller (+ a group if multi-seller). The authoritative totals
 * (charges/discount/tax) live on each created order — read them back via orders.get. */
export interface CheckoutResult { orders: Array<{ id: string; orderNo: string; totalMinor: string; status: string }>; checkoutGroupId: string | null; }

/** One seller's slice of the read-only checkout totals preview (server-computed; money minor-unit strings). */
export interface CheckoutPreviewSeller {
  sellerUserId: string;
  items: Array<{ listingId: string; title: string; quantity: number; unitCode: string; unitPriceMinor: string; lineTotalMinor: string }>;
  subtotalMinor: string; deliveryFeeMinor: string; platformFeeMinor: string; discountMinor: string; totalMinor: string;
  couponError?: string;
}
/** Server-authoritative bill BEFORE checkout (no order, no money moved). Totals = sum of the seller slices. */
export interface CheckoutPreview {
  currencyCode: string; sellers: CheckoutPreviewSeller[];
  subtotalMinor: string; deliveryFeeMinor: string; platformFeeMinor: string; discountMinor: string; grandTotalMinor: string;
  couponCode: string | null;
}
/** One serviceable delivery option for the destination, with its server-computed fee (minor-unit string). */
export interface DeliveryMethod { id: string; name: string; feeMinor: string; }
/** Read-only delivery-methods lookup for the active cart + destination (no order, no money moved). When empty,
 *  no zone serves the destination — the storefront falls back to the preview's generic delivery fee. */
export interface DeliveryMethodsResult { currencyCode: string; subtotalMinor: string; methods: DeliveryMethod[]; }
/** Result of paying an order from the buyer's wallet (the order confirms shortly after, async). */
export interface WalletPaymentResult { orderId: string; paymentId: string; status: string; amountMinor: string; currencyCode: string; }

// --- addresses (module 1, identity) — the buyer's delivery address book ---
export interface Address {
  id: string; line1: string; line2?: string | null; village?: string | null; regionId?: string | null;
  pincode?: string | null; countryCode?: string; contactName?: string | null; contactPhone?: string | null;
  lat?: number | null; lng?: number | null; labelId?: string | null; isDefault: boolean;
}

// --- offers (module 3) — negotiation; money is bigint minor-unit STRINGS (Law 2) ---
/** A listing offer. `quantity` is a decimal string (up to 3 dp); prices are bigint minor-unit strings.
 * `convertedOrderId` is set once an accept turns the offer into an order. */
export interface ListingOffer {
  offerId: string; listingId: string; buyerUserId: string; quantity: string;
  offeredPriceMinor: string; counterPriceMinor: string | null; round: number; status: string;
  expiresAt?: string | null; convertedOrderId?: string | null; createdAt?: string;
}

// --- messaging (communication) ---
export type ConversationContext = 'order' | 'requirement' | 'dispute' | 'booking' | 'direct' | 'support_ticket';
export interface Conversation { id: string; contextType: string; contextId: string | null; isLocked: boolean; createdAt?: string; }
/** A chat message. Exactly one of body/voiceMediaId/attachmentMediaId carries the content; media are referenced
 * by id only (the bytes live in S3). NO raw PII. */
export interface Message {
  id: string; conversationId: string; senderUserId: string; body: string | null;
  voiceMediaId: string | null; attachmentMediaId: string | null; isAiGenerated: boolean; isFlagged: boolean; createdAt?: string;
}
/** A privacy-proxy (masked) call record — the provider bridges the two real numbers SERVER-SIDE; NO phone number
 * is ever returned to the client. */
export interface MaskedCall { id: string; callerUserId: string; calleeUserId: string; contextType: string | null; contextId: string | null; durationSecs?: number | null; createdAt?: string; }

// --- auctions (module 3) — money is bigint minor-unit STRINGS (Law 2); EMD held/refunded server-side ---
export type AuctionKind = 'english_open' | 'sealed';
export interface Auction {
  auctionId: string; listingId: string; kind: string; status: string;
  startPriceMinor: string; reservePriceMinor: string | null; minIncrementMinor: string;
  /** EMD (earnest-money deposit) the bidder must have held to bid: a flat `emdMinor` (bigint minor-unit string)
   * when > "0", else a percentage of the bid via `emdPctBps` (basis points). Both can be "0"/null (no EMD). */
  emdMinor: string; emdPctBps: number | null;
  startsAt: string; endsAt: string; winningBidId: string | null; createdAt?: string;
}
/** One bid in the history. `amountMinor` is null when a sealed auction masks another bidder's amount
 * (server-side) until close — a bidder always sees their own. */
export interface BidHistoryItem { id: string; bidderUserId: string; amountMinor: string | null; createdAt?: string; }
/** Result of placing a bid. `extended` = the soft-close auto-extended the end time. */
export interface PlaceBidResult { bidId: string; auctionId: string; amountMinor: string; extended: boolean; endsAt: string; }
/** One of the caller's bids across auctions ("my bids"), with the EMD hold + winning flag. Money minor-unit strings. */
export interface MyBid {
  bidId: string; auctionId: string; listingId: string; amountMinor: string; emdHeldMinor: string;
  auctionStatus: string; endsAt: string; isWinning: boolean; createdAt: string;
}
/** An auction the caller is WATCHING (follow). `status`/`endsAt` are the live auction's, `watchedAt` is when the
 * caller started watching. No money lives here. */
export interface WatchedAuction { auctionId: string; status: string; endsAt: string; watchedAt: string; }

// --- labour (module 6) — money is bigint minor-unit STRINGS (Law 2) ---
/** A worker's self-managed profile. `ageVerified18` is set out-of-band (KYC/admin) — NOT client-settable; the
 * server hard-gates accepting work on it. */
export interface WorkerProfile {
  id: string; userId: string; ageVerified18: boolean; villageRegionId: string | null; travelKm: number | null;
  stayAwayOk: string | null; minWageExpectationMinor: string | null; autoAcceptAboveMinor: string | null;
  hasSmartphone: boolean | null; ratingAvg: number | null; bookingsCompleted: number | null; noShowCount: number | null;
  /** The caller's self-declared skill ids — present on the `myWorker()` read. */
  skillIds?: string[]; createdAt?: string;
}
/** A labour booking (a job). Workers browse `box=open`; the employer owns `box=mine`. `respondBy` is the
 * accept/decline window deadline (server-enforced). */
export interface LabourBooking {
  id: string; bookingNo: string; employerUserId: string; demandTypeId: string | null; taskSkillId: string | null;
  workersNeeded: number; startDate: string; endDate: string | null; wageKind: string; wageOfferedMinor: string;
  minWageMinor: string; currencyCode: string; womenOnly: boolean; status: string; respondBy: string | null; version?: number; createdAt?: string;
}
/** A worker's assignment to a booking (the "job offer"). The worker accepts/rejects within the booking's window. */
export interface LabourAssignment { id: string; bookingId: string; workerId: string; status: string; wageMinor: string; acceptedAt: string | null; createdAt?: string; }
/** A geo-fenced clock-in receipt. `distanceM` is the SERVER-computed metres from the farm (≤100m fence). */
// An attendance day. clock-in carries distanceM/method; clock-out/confirm + work-history carry the lifecycle
// (status clocked_in→clocked_out→confirmed) + SERVER-computed hours/overtime (P0-9). Fields are optional because
// the same shape serves all four endpoints. Hours are numbers (not money — wages settle only in the ledger).
export interface LabourAttendance {
  id: string; assignmentId: string; bookingId: string; workDate: string;
  clockInAt?: string | null; clockOutAt?: string | null; distanceM?: number; method?: string;
  status?: 'clocked_in' | 'clocked_out' | 'confirmed'; breakMinutes?: number;
  hoursRegular?: number | null; hoursOvertime?: number; confirmedByEmployer?: boolean; paid?: boolean; createdAt?: string;
}
/** The labour taxonomy catalogue for client pickers (real server ids + human labels). */
export interface LabourLookups {
  workTypes: { id: string; code: string; name: string }[];
  skills: { id: string; code: string; name: string; tier: number; parentId: string | null; hazardous: boolean }[];
  regions: { id: string; code: string | null; name: string }[];
  skillLevels: string[];
}

// --- ambassadors (module 7 — village acquisition agents) — money is bigint minor STRINGS (Law 2) ---
/** The caller's own ambassador profile (PII-minimised: no name/phone). monthlyStipendMinor is bigint minor. */
export interface AmbassadorProfile {
  id: string; userId: string; clusterRegionIds: string[]; tierId: string | null; mentorAmbassadorId: string | null;
  trainingCompletedAt: string | null; kioskEnabled: boolean; aepsEnabled: boolean; monthlyStipendMinor: string;
  lastActivityAt: string | null; isActive: boolean; createdAt?: string;
}
/** A referral the ambassador created/owns. status: invited→signed_up→activated→rewarded (server-enforced). */
export interface Referral { id: string; referrerUserId: string; refereeUserId: string | null; code: string; status: string; createdAt?: string; }
/** A commission/stipend earning accrued to the ambassador (server-computed). amountMinor is bigint minor. */
export interface AmbassadorEarning { id: string; ambassadorId: string; eventCode: string; referenceType: string | null; referenceId: string | null; amountMinor: string; payoutId: string | null; createdAt?: string; }
/** A commission plan (read-only catalogue for display). */
export interface CommissionPlan { id: string; code: string; name?: string; [k: string]: unknown; }
/** A geo-stamped field visit logged by an ambassador. */
export interface AmbassadorVisit { id: string; ambassadorId: string; visitedUserId: string | null; purpose: string; notes: string | null; lat: number | null; lng: number | null; regionId: string | null; visitedAt: string; createdAt?: string; }
/** A per-period goal for one metric. `targetValue` is a count, or bigint minor units for 'earnings_minor'. */
export interface AmbassadorTarget { id: string; ambassadorId: string; metric: string; periodStart: string; periodEnd: string; targetValue: string; createdAt?: string; }
/** A leaderboard row: an ambassador ranked by commission earned (bigint minor) in the window. */
export interface LeaderboardEntry { ambassadorId: string; userId: string; tierId: string | null; earnedMinor: string; events: number; rank: number; }
/** The result of an assisted onboarding: the created/resolved farmer + the attribution referral id. */
export interface AssistedOnboardingResult { user: { id: string; [k: string]: unknown }; ambassadorId: string; referralId: string | null; }
// --- ambassadors admin (P1-12) — tenant-operator surface; money is bigint minor STRINGS, moved server-side (Law 2/11) ---
export type AmbassadorTargetMetric = 'onboardings' | 'sales_facilitated' | 'earnings_minor' | 'visits';
export interface EnrollAmbassadorInput { userId: string; clusterRegionIds?: string[]; tierId?: string | null; mentorAmbassadorId?: string | null; kioskEnabled?: boolean; aepsEnabled?: boolean; monthlyStipendMinor?: string; }
export interface UpdateAmbassadorInput { clusterRegionIds?: string[]; tierId?: string | null; mentorAmbassadorId?: string | null; kioskEnabled?: boolean; aepsEnabled?: boolean; monthlyStipendMinor?: string; trainingCompleted?: boolean; }
export interface SetTargetInput { ambassadorId: string; metric: AmbassadorTargetMetric; periodStart: string; periodEnd: string; targetValue: string; }
/** The result of an ambassador commission payout (server-computed, wallet-moved). */
export interface AmbassadorPayoutResult { payoutId: string; ambassadorId: string; paidMinor: string; earningCount: number; }
// --- group lots (FPO pooling, P1-12) — quantities are decimal STRINGS; money bigint minor STRINGS (Law 2) ---
export type GroupLotStatus = 'pledging' | 'ready' | 'listed' | 'sold' | 'settled' | 'cancelled';
/** A pooled FPO lot. progressBps = pledged ÷ target in integer basis points. */
export interface GroupLot {
  id: string; coordinatorUserId: string; productId: string; targetQuantity: string; pledgedQuantity: string;
  unitCode: string; pledgeDeadline: string; status: GroupLotStatus; coordinationFeeBps: number; progressBps: number; createdAt?: string | null;
}
export interface GroupLotPledge { id: string; farmerUserId: string; quantity: string; qualityOk: boolean | null; settledShareMinor: string | null; }
export interface GroupLotDetail extends GroupLot { pledges: GroupLotPledge[]; }
export interface CreateGroupLotInput { productId: string; targetQuantity: string; unitCode: string; pledgeDeadline: string; coordinationFeeBps?: number; }
/** The proportional settlement breakdown (float-free, sums exactly to net — Law 2). Money is NOT moved by this call. */
export interface GroupLotSettlement extends GroupLot {
  settlement: { grossMinor: string; coordinationFeeMinor: string; netMinor: string; shares: { pledgeId: string; shareMinor: string }[] };
}

// --- audit trail (read-only auditor surface — P1-12) ---
/** One append-only audit_log entry (read-only). `id` is a bigint as a string. oldValue/newValue are arbitrary
 *  JSON snapshots of the change. ip/user_agent are intentionally NOT exposed. */
export interface AuditEntry {
  id: string; actorUserId: string | null; actorRole: string | null; action: string;
  entityType: string | null; entityId: string | null; oldValue: unknown; newValue: unknown;
  reason: string | null; requestId: string | null; createdAt: string;
}

// --- AI review queue (human-in-the-loop ops surface — P1-12) ---
export type AiReviewStatus = 'pending' | 'in_review' | 'accepted' | 'rejected';
export type AiReviewQueueKind = 'fraud_flag' | 'low_confidence_grade' | 'price_anomaly' | 'dispute_triage' | 'drift' | 'manual';
/** A human-in-the-loop review item. `inferenceId` links the AI decision under review (null for manual items).
 *  A reviewer claims a pending item then resolves it accepted/rejected; the resolution drives the originating
 *  module server-side. */
export interface AiReviewItem {
  id: string; inferenceId: string | null; queueKind: AiReviewQueueKind | string; priority: number;
  status: AiReviewStatus; reviewerUserId: string | null; decisionNote: string | null;
  resolvedAt: string | null; createdAt?: string | null;
}
export interface EnqueueReviewInput { queueKind: AiReviewQueueKind; priority?: number; subjectType?: string | null; subjectId?: string | null; }
export interface ResolveReviewInput { decision: 'accepted' | 'rejected'; note?: string | null; }

// --- education (module 9 — courses/lessons/enrollments) — money is bigint minor STRINGS (Law 2) ---
/** A course (training). `priceMinor` 0 = free. Browse returns published courses. */
export interface Course {
  id: string; instructorId: string; defaultTitle: string; topicId: string | null; audienceRoleIds: string[];
  level: string; priceMinor: string; currencyCode: string; certEnabled: boolean; coverMediaId: string | null;
  status: string; createdAt?: string;
}
/** A lesson within a course. `contentKind` ∈ video|pdf|article|quiz|live|audio. `quiz` is an opaque JSON payload
 * (parsed defensively client-side). `mediaId` resolves to a presigned URL via the media resource. */
export interface CourseLesson {
  id: string; courseId: string; moduleNo: number; lessonNo: number; defaultTitle: string; contentKind: string;
  mediaId: string | null; body: string | null; durationSecs: number | null; quiz: unknown | null; createdAt?: string;
}
/** The caller's own enrollment in a course (progress + completion + certificate). */
export interface Enrollment {
  id: string; courseId: string; learnerUserId: string; paymentId: string | null; progressPct: number;
  completedAt: string | null; certificateMediaId: string | null; createdAt?: string;
}
/** Per-lesson progress within an enrollment. */
export interface LessonProgress { lessonId: string; completedAt: string | null; secondsWatched: number; quizScore: number | null; }

// --- learning resources / tips (creator-content; P-20 tips + crop hub) ---
/** A curated learning resource (tip / article / video / blog / post / audio). `box=browse` returns only
 * APPROVED resources (server-enforced). `body` is inline text; `externalUrl`/`mediaId` is the asset. `topicId`
 * is a catalogue topic id (no public name endpoint yet). Read-only for the app. */
export type ResourceKind = 'video' | 'blog' | 'post' | 'audio' | 'article';
export interface LearningResource {
  id: string; channelId: string | null; ownerUserId: string; kind: ResourceKind; title: string;
  externalUrl: string | null; mediaId: string | null; topicId: string | null; languageCode: string | null;
  body: string | null; status: string; reviewedBy?: string | null; reviewedAt?: string | null; createdAt?: string;
}

// --- AI assistant (P-20 AI-chat) — ASSUMED contract; no farmer-facing endpoint is live yet (flagged) ---
/** One turn of the assistant's reply. `sessionId` threads a conversation; `citations` are optional source links
 * the server attaches (the app renders only what the server returns — never fabricates an answer). */
export type AssistantStatus = 'answered' | 'needs_review' | 'blocked';
export interface AssistantReply { reply: string; sessionId: string; status?: AssistantStatus; citations?: Array<{ title: string; url?: string }>; }

// --- govt schemes (module — global scheme catalogue + the caller's applications + DBT) — money bigint STRINGS (Law 2) ---
/** A government scheme (GLOBAL catalogue). `benefitSummary`/`eligibilityRules` are opaque JSON the app renders/
 * evaluates server-side; `requiredDocTypeIds` lists doc types to attach; `processingFeeMinor` is bigint minor. */
export interface Scheme {
  id: string; code: string; name: string; authorityId: string; categoryId: string;
  benefitSummary: Record<string, unknown>; eligibilityRules: Record<string, unknown>; requiredDocTypeIds: string[];
  applicationWindow: Record<string, unknown> | null; applicableRegionIds: string[]; processingFeeMinor: string;
  version: number; isActive: boolean; createdAt?: string;
}
export interface SchemeAuthority { id: string; name: string; level: string; regionId: string | null; }
/** The deterministic, explainable eligibility result (PRD right-to-explanation): server-evaluated. */
export interface EligibilityResult { eligible: boolean; reasons: string[]; }
export type ApplicationStatus = 'draft' | 'submitted' | 'under_verification' | 'clarification_needed' | 'approved' | 'rejected' | 'disbursed' | 'closed' | 'appealed';
/** The caller's OWN scheme application (server resolves the applicant — no IDOR). `formData` is the submitted
 * answers (incl. attached document refs); `eligibilityCheck` is the stored result at apply time. */
export interface SchemeApplication {
  id: string; schemeId: string; schemeVersion: number; applicantUserId: string; assistedBy: string | null;
  status: ApplicationStatus; formData: Record<string, unknown>; govtAppRef: string | null;
  eligibilityCheck: Record<string, unknown> | null; submittedAt: string | null; decidedAt: string | null;
  rejectionReason: string | null; createdAt?: string;
}
/** An observed PFMS/DBT credit against an application. `amountMinor` is bigint minor (Law 2). Read-only for the app. */
export interface DbtTransfer {
  id: string; applicationId: string | null; userId: string; schemeId: string; amountMinor: string;
  instalmentNo: number | null; creditedOn: string; pfmsRef: string | null; createdAt?: string;
}

// --- support tickets (P-22 help/complaint) ---
export type TicketSeverity = 'P0' | 'P1' | 'P2' | 'P3';
export type TicketStatus = 'open' | 'pending_customer' | 'pending_internal' | 'escalated' | 'resolved' | 'closed' | 'reopened';
/** The caller's OWN support ticket. SLA due-times are server-set from severity; the app shows them read-only.
 * `csatScore` is the caller's satisfaction rating once resolved. No money here. */
export interface SupportTicket {
  id: string; ticketNo: string; requesterUserId: string | null; channel: string; categoryId: string | null;
  severity: TicketSeverity; subject: string | null; status: TicketStatus; assigneeUserId: string | null;
  conversationId: string | null; slaFirstResponseDue: string | null; slaResolutionDue: string | null;
  firstRespondedAt: string | null; resolvedAt: string | null; csatScore: number | null; createdAt?: string;
}

// --- DPDP privacy (P-23 data-download / account-delete / change-phone) — ASSUMED contracts (endpoints not live) ---
/** A data-subject request (export or erasure). `status` is server-driven (pending→processing→ready/done). The app
 * only submits + reflects status — it never produces the export itself (the server compiles it; Law 11). */
export interface PrivacyRequest { id: string; kind: 'export' | 'deletion'; status: string; requestedAt?: string; readyAt?: string; downloadUrl?: string | null; }

// --- land parcels (P-22 farm details) ---
/** A land parcel the farmer owns/farms. `area` is a decimal STRING in `areaUnit` (e.g. acre) — not money. */
export interface LandParcel {
  id: string; ownerUserId: string; regionId: string | null; surveyNo: string | null; bhulekhRef: string | null;
  area: string; areaUnit: string; irrigationTypeId: string | null; boundaryGeojson: Record<string, unknown> | null;
  verificationStatus: string; isTenantFarmed: boolean; createdAt?: string;
}

// --- tenancy + tenant-admin-lite (P-17) — money is bigint minor STRINGS (Law 2) ---
/** A subscription plan (read-only catalogue). All *Minor are bigint minor strings. */
export interface Plan {
  id: string; code: string; version: number; defaultName: string; countryCode: string; currencyCode: string;
  monthlyPriceMinor: string; annualPriceMinor: string; setupFeeMinor: string; isPublic: boolean; isActive: boolean;
  limits: Record<string, string>; createdAt?: string;
}
/** The tenant's subscription (status drives apply/pending UX). */
export interface Subscription {
  id: string; tenantId: string; planId: string; status: string; billingCycle: string; priceMinor: string;
  currencyCode: string; currentPeriodStart: string | null; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; createdAt?: string;
}
/** A role assignment (the tenant's roster + approval queue). Pending = not yet approved (approvedAt null). */
export interface RoleAssignment { id: string; userId: string; roleId?: string; roleCode: string; kycStatus: string; isActive: boolean; approvedAt: string | null; }
/** A role in the tenant's catalogue. `scope:'platform'` roles are NOT assignable via the tenant API (Law 11). */
export interface RoleDef { id: string; code: string; defaultName: string; scope: 'tenant' | 'platform'; requiresKyc: boolean; requiresApproval: boolean; moduleCode: string | null; isActive: boolean; }
/** A permission in the catalogue (for the role→permission matrix). */
export interface PermissionDef { code: string; defaultName: string; moduleCode: string | null; }
/** Assign a role to a member. `roleData` carries role-specific config (e.g. region scoping). */
export interface AssignRoleInput { userId: string; roleCode: string; roleData?: Record<string, unknown>; }
/** A per-assignment permission override (grant or deny one permission). */
export interface StaffOverrideInput { userTenantRoleId: string; permissionCode: string; isGranted: boolean; }
/** The tenant's own analytics dashboard over a window. All money is bigint minor STRINGS (Law 2). */
export interface TenantAnalytics {
  windowFrom: string; windowTo: string; currencyCode: string;
  gmvMinor: string; orders: number; commissionMinor: string; platformFeeMinor: string;
  refundedOrders: number; activeListings: number; disputesOpen: number; payoutsPaidMinor: string;
  topProducts: { productId: string; quantity: string; salesMinor: string }[];
  topSellers: { sellerUserId: string; orders: number; salesMinor: string }[];
}
/** A tenant→audience broadcast (status queued→sending→sent; counts reflect enqueued recipients). */
export interface TenantBroadcast { id: string; audienceRoleCode: string | null; title: string; body: string; status: string; recipientCount: number; sentCount: number; failureReason: string | null; createdAt?: string; }

// --- tenant self-config (P1-10): commission-rules / delivery-zones / settings (branding+languages) ---
// Money rules stay SERVER-authoritative: the app never computes a fee — it only reads/edits the rule rows.
// All *Minor are bigint minor STRINGS (Law 2). `scope:'platform'` rows are read-only inherited defaults (Law 11).
/** A commission rule. Platform rows (scope 'platform') are god-mode defaults — read-only here. */
export interface CommissionRule {
  id: string; scope: 'platform' | 'tenant'; categoryId: string | null; source: string | null; sellerRoleId: string | null;
  rateBps: number; fixedMinor: string; capMinor: string | null; platformShareBps: number; chargedTo: 'seller' | 'buyer';
  priority: number; effectiveFrom: string | null; effectiveTo: string | null; isActive: boolean;
}
/** Input to create a tenant commission rule. rateBps/platformShareBps in basis-points (0–100000). */
export interface CreateCommissionRuleInput {
  categoryId?: string | null; source?: 'direct' | 'auction' | 'requirement' | 'subscription' | null; sellerRoleId?: string | null;
  rateBps: number; fixedMinor?: string; capMinor?: string | null; platformShareBps: number;
  chargedTo?: 'seller' | 'buyer'; priority?: number; effectiveFrom?: string; effectiveTo?: string | null;
}
/** A delivery zone (set of pincodes / regions, optional charge definition). */
export interface DeliveryZone {
  id: string; defaultName: string; pincodes: string[]; regionIds: string[]; chargeDefinitionId: string | null; isActive: boolean; createdAt?: string | null;
}
/** Input to create a delivery zone. */
export interface CreateDeliveryZoneInput { defaultName: string; pincodes?: string[]; regionIds?: string[]; chargeDefinitionId?: string | null; }
/** Patch to a delivery zone (all fields optional). */
export interface UpdateDeliveryZoneInput { defaultName?: string; pincodes?: string[]; regionIds?: string[]; chargeDefinitionId?: string | null; }
/** A tenant setting row (typed value validated server-side against its definition). Used for branding + languages. */
export interface TenantSetting { key: string; value: unknown; }
/** A read-only feature override the tenant inherits from its plan (cannot self-grant — Law 11). */
export interface TenantFeature { key: string; isEnabled: boolean; }

// --- tenant integrations (P1-11) — credentials are vaulted server-side; the SDK never sees a secret ---
/** A connectable third-party provider (global catalogue). */
export interface IntegrationProvider { code: string; defaultName: string; category: string; isActive: boolean; }
/** A tenant's connection to a provider. `connected` = a vaulted credential exists; the secret ref is NEVER returned. */
export interface TenantIntegration { id: string; providerCode: string; providerName: string | null; category: string | null; config: Record<string, unknown>; connected: boolean; isActive: boolean; createdAt?: string | null; }
/** A tenant webhook endpoint (masked — the signing secret is returned ONLY on register/rotate, never on reads). */
export interface WebhookEndpoint { id: string; url: string; eventTypes: string[]; isActive: boolean; createdAt?: string | null; }
// --- dairy (MCC operator console, P1-12) — money is bigint minor STRINGS; weight/fat/snf are decimal STRINGS (Law 2) ---
export type DairyAnimalType = 'cow' | 'buffalo' | 'mixed';
export type DairyPaymentCycle = 'daily' | 'weekly' | 'fortnightly' | 'monthly';
export type DairyPricingModel = 'two_axis' | 'fat_pooled' | 'snf_pooled';
export type DairyShift = 'morning' | 'evening';
export type MilkBillStatus = 'draft' | 'previewed' | 'disputed' | 'approved' | 'paid';
/** A Milk Collection Centre (cooperative branch). lat/lng are decimal strings; no PII. */
export interface DairyMcc {
  id: string; code: string; defaultName: string; regionId: string | null; lat: string | null; lng: string | null;
  operatorUserId: string | null; capacityLitresShift: string | null; isActive: boolean; createdAt?: string | null;
}
/** A farmer's membership at an MCC. */
export interface DairyMembership {
  id: string; farmerUserId: string; mccId: string; memberCode: string;
  paymentCycle: DairyPaymentCycle; defaultAnimalType: DairyAnimalType | null; isActive: boolean; createdAt?: string | null;
}
/** A milk rate card. Rates are bigint minor-unit strings (Law 2). */
export interface DairyRateCard {
  id: string; defaultName: string; animalType: DairyAnimalType; pricingModel: DairyPricingModel;
  ratePerKgFatMinor: string | null; ratePerKgSnfMinor: string | null; baseRatePerLitreMinor: string | null;
  effectiveFrom: string; effectiveTo: string | null; isActive: boolean;
}
/** A counter milk-collection row. amountMinor is server-priced from the rate card (float-free). */
export interface DairyCollection {
  id: string; membershipId: string; mccId: string; shift: DairyShift; collectedOn: string;
  amountMinor: string; rateCardId: string; waterFlag: boolean; milkBillId: string | null; createdAt?: string | null;
}
/** A per-cycle milk settlement bill. All money bigint minor strings; totalLitres is a 3-dp string. */
export interface MilkBill {
  id: string; membershipId: string; periodStart: string; periodEnd: string; totalLitres: string;
  grossMinor: string; deductions: Array<{ type: string; amountMinor: string }>; deductionsMinor: string;
  netMinor: string; status: MilkBillStatus; disputeWindowEnds: string | null; payoutId: string | null; createdAt?: string | null;
}
export interface CreateMccInput { code: string; defaultName: string; regionId?: string; lat?: string; lng?: string; operatorUserId?: string; capacityLitresShift?: string; analyzerModel?: string; analyzerSerial?: string; }
export interface EnrolMemberInput { farmerUserId: string; mccId: string; memberCode: string; paymentCycle?: DairyPaymentCycle; defaultAnimalType?: DairyAnimalType; }
export interface CreateRateCardInput { defaultName: string; animalType: DairyAnimalType; pricingModel: DairyPricingModel; ratePerKgFatMinor?: string; ratePerKgSnfMinor?: string; baseRatePerLitreMinor?: string; effectiveFrom: string; effectiveTo?: string; }
export interface RecordCollectionInput { membershipId: string; shift: DairyShift; collectedOn: string; weightKg: string; fatPct: string; snfPct: string; waterFlag?: boolean; adulterationFlags?: string[]; }
export interface GenerateBillInput { membershipId: string; periodStart: string; periodEnd: string; deductions?: Array<{ type: string; amountMinor: string }>; }
// --- market-intel (mandi prices) + weather (P-19) — money is bigint minor STRINGS (Law 2) ---
/** A mandi (market yard). lat/lng for map/nearest; no PII. */
export interface Mandi { id: string; defaultName: string; regionId: string | null; mandiCode: string | null; lat: number | null; lng: number | null; isActive: boolean; }
/** A daily mandi price row. min/max/modal are bigint minor STRINGS per `unitCode` (e.g. per quintal). */
export interface MandiPrice {
  id: string; mandiId: string | null; regionId: string | null; productId: string; gradeOptionId: string | null; priceDate: string;
  minMinor: string | null; maxMinor: string | null; modalMinor: string; unitCode: string; arrivalsQty: number | null; source: string | null;
  // API-W11 catalogue name-join (null if the id no longer resolves — degrade, never blank the row).
  productName?: string | null; gradeName?: string | null; regionName?: string | null;
}
/** A price prediction band (p10/p50/p90 bigint minor). */
export interface PricePrediction {
  productId: string; regionId: string | null; gradeOptionId: string | null; targetDate: string; p10Minor: string; p50Minor: string; p90Minor: string; confidence: number | null; modelVersion: string | null; createdAt?: string;
  productName?: string | null; gradeName?: string | null; regionName?: string | null;
}
/** The live pulse for a (product, region): the latest price, the prediction band, and recent history. */
export interface MandiPulse { latest: MandiPrice | null; band: PricePrediction | null; history: MandiPrice[]; }
/** The caller's price alert (threshold subscription). thresholdMinor is bigint minor. */
export interface PriceAlert { id: string; productId: string; regionId: string | null; direction: 'above' | 'below'; thresholdMinor: string; isActive: boolean; createdAt?: string; }
/** A regional weather advisory (read-only ingested reference data). `advisoryTextKey` is an i18n key. */
export interface WeatherAlert { id: string; regionId: string; alertTypeId: string | null; severity: string; validFrom: string | null; validTo: string | null; advisoryTextKey: string; payload?: Record<string, unknown> | null; source: string | null; createdAt?: string; }

// --- geocoded forecast (P0-12). Temps °C, precip mm, prob 0-100, wind km/h — provider units normalised server-side.
export interface ForecastDay { date: string; tempMinC: number; tempMaxC: number; precipMm: number; precipProbPct: number; windKph: number; code: string; }
export interface NormalisedForecast { lat: number; lng: number; providerCode: string; fetchedAt: string; days: ForecastDay[]; }
/** Either a real forecast (degraded:false) or — provider down + regionId given — degraded:true with advisories. */
export interface ForecastResult { degraded: boolean; source: 'forecast' | 'advisory'; providerCode: string | null; forecast: NormalisedForecast | null; advisories: WeatherAlert[]; }

/** A dispute (moderation view for a tenant with dispute.resolve). resolutionAmountMinor is bigint minor. */
export interface Dispute {
  id: string; orderId: string; raisedBy: string; againstUser: string | null; reasonId: string | null; description: string | null;
  status: string; sellerRespondBy: string | null; resolutionType: string | null; resolutionAmountMinor: string | null;
  resolvedBy: string | null; resolvedAt: string | null; slaDueAt: string | null; createdAt?: string;
}

// --- media (core/media) ---
export type MediaKind = 'image' | 'video' | 'audio' | 'document';
/** Presigned PUT ticket: upload the raw bytes to `uploadUrl` (S3, NOT the API host), then confirm. */
export interface MediaUploadTicket { mediaId: string; s3Key: string; uploadUrl: string; expiresInSec: number; }
/** After the PUT, confirm records the real size + sha256 (+dims for images). Scan runs async server-side. */
export interface MediaConfirmResult { mediaId: string; status: string; }
/** Time-bounded presigned GET — only returned for a clean, visible asset. */
export interface MediaDownloadLink { mediaId: string; url: string; expiresInSec: number; }
