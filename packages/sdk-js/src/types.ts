// @krishi-verse/sdk-js · response types mirroring the API read-models. MONEY IS ALWAYS A STRING of bigint minor
// units (Law 2) — never a JS number, so a large balance/price never loses precision in a browser.
export interface Page<T> { items: T[]; nextCursor: string | null; total?: number | null; }

export interface ListingCard {
  id: string; title: string; priceMinor: string; currencyCode: string; unitCode: string;
  quantityAvailable: number; organicClaim: boolean; saleType: string; regionId: string | null;
  sellerUserId: string; boosted: boolean;
  /** Present on owner/detail reads (optimistic-concurrency token for price edits). */
  version?: number;
  status?: string;
}
export interface ListingQuery {
  q?: string; categoryId?: string; regionId?: string; saleType?: string; organic?: boolean;
  priceMinMinor?: string; priceMaxMinor?: string; sort?: 'newest' | 'price_asc' | 'price_desc'; cursor?: string; limit?: number;
}
export interface ProductCard { id: string; name: string; categoryId: string; defaultUnit: string; brandId: string | null; gstRatePct: number | null; isPerishable: boolean; isPlatform: boolean; }

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
export interface PayoutSummary { id: string; status: string; amountMinor: string; currencyCode: string; purpose?: string; createdAt?: string; }
export interface BankAccount { id: string; accountKind: 'bank' | 'upi'; upiId?: string | null; accountLast4?: string | null; ifsc?: string | null; holderName?: string | null; isPrimary: boolean; }

// --- KYC (module 1, identity) — never carries raw doc numbers, only masked + media refs ---
export type KycStatus = 'pending' | 'verified' | 'rejected' | 'expired';
export interface KycDocument { id: string; status: KycStatus; docTypeId?: string; mediaId?: string; docNoMasked?: string | null; rejectReason?: string | null; createdAt?: string; }

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

// --- cart + checkout (module 3) — money is bigint minor-unit STRINGS (Law 2) ---
export interface CartItem {
  listingId: string; title: string | null; quantity: number; unitPriceMinor: string; lineTotalMinor: string;
  priceChanged: boolean; available: number; purchasable: boolean;
}
export interface Cart { items: CartItem[]; subtotalMinor: string; }
/** Checkout converts the cart into one order per seller (+ a group if multi-seller). The authoritative totals
 * (charges/discount/tax) live on each created order — read them back via orders.get. */
export interface CheckoutResult { orders: Array<{ id: string; orderNo: string; totalMinor: string; status: string }>; checkoutGroupId: string | null; }

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
  startsAt: string; endsAt: string; winningBidId: string | null; createdAt?: string;
}
/** One bid in the history. `amountMinor` is null when a sealed auction masks another bidder's amount
 * (server-side) until close — a bidder always sees their own. */
export interface BidHistoryItem { id: string; bidderUserId: string; amountMinor: string | null; createdAt?: string; }
/** Result of placing a bid. `extended` = the soft-close auto-extended the end time. */
export interface PlaceBidResult { bidId: string; auctionId: string; amountMinor: string; extended: boolean; endsAt: string; }

// --- labour (module 6) — money is bigint minor-unit STRINGS (Law 2) ---
/** A worker's self-managed profile. `ageVerified18` is set out-of-band (KYC/admin) — NOT client-settable; the
 * server hard-gates accepting work on it. */
export interface WorkerProfile {
  id: string; userId: string; ageVerified18: boolean; villageRegionId: string | null; travelKm: number | null;
  stayAwayOk: string | null; minWageExpectationMinor: string | null; autoAcceptAboveMinor: string | null;
  hasSmartphone: boolean | null; ratingAvg: number | null; bookingsCompleted: number | null; noShowCount: number | null; createdAt?: string;
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

// --- media (core/media) ---
export type MediaKind = 'image' | 'video' | 'audio' | 'document';
/** Presigned PUT ticket: upload the raw bytes to `uploadUrl` (S3, NOT the API host), then confirm. */
export interface MediaUploadTicket { mediaId: string; s3Key: string; uploadUrl: string; expiresInSec: number; }
/** After the PUT, confirm records the real size + sha256 (+dims for images). Scan runs async server-side. */
export interface MediaConfirmResult { mediaId: string; status: string; }
/** Time-bounded presigned GET — only returned for a clean, visible asset. */
export interface MediaDownloadLink { mediaId: string; url: string; expiresInSec: number; }
