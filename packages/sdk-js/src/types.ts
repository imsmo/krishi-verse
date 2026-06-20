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

// --- media (core/media) ---
export type MediaKind = 'image' | 'video' | 'audio' | 'document';
/** Presigned PUT ticket: upload the raw bytes to `uploadUrl` (S3, NOT the API host), then confirm. */
export interface MediaUploadTicket { mediaId: string; s3Key: string; uploadUrl: string; expiresInSec: number; }
/** After the PUT, confirm records the real size + sha256 (+dims for images). Scan runs async server-side. */
export interface MediaConfirmResult { mediaId: string; status: string; }
/** Time-bounded presigned GET — only returned for a clean, visible asset. */
export interface MediaDownloadLink { mediaId: string; url: string; expiresInSec: number; }
