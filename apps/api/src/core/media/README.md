# core/media — S3 presign + scan-gated media

The media boundary: clients upload **directly to S3** via short-lived presigned URLs (the API never
proxies bytes), and nothing is downloadable until an antivirus scan clears it. Used by listings
(images), KYC (documents), and the billing module (statement/invoice PDFs via `putGeneratedDocument`).

## Lifecycle
1. `POST /v1/media/upload-url` → validate kind + MIME (allow-list) + size cap → create a `pending`
   `media_assets` row → return a presigned **PUT** URL (client uploads straight to S3).
2. `POST /v1/media/:id/confirm` → record real bytes/sha256/dimensions (owner-checked).
3. **AV scan** → the scanner POSTs `POST /v1/media/scan-callback` (HMAC-signed); the tenant + media
   id come from the signature-verified S3 key → `scan_status` becomes `clean`/`infected`/`failed`.
4. `GET /v1/media/:id/download-url` → presigned **GET** URL — ONLY when `scan_status='clean'` and the
   caller may see it.

`putGeneratedDocument(tenantId, pdfBytes)` uploads server-generated PDFs (resilience-wrapped PUT) and
records them as clean tenant documents — the storage hook for statement/invoice PDFs.

## Security properties (threats considered)
- **SigV4 presigner is self-contained** (no SDK) — deterministic, unit-tested; payload is
  UNSIGNED-PAYLOAD; credentials never logged. URLs are short-lived (default 15 min).
- **Scan gate / fail closed** — a file is NEVER downloadable until the AV scan returns `clean`;
  `pending`/`infected`/`failed` ⇒ withheld (409). The scan callback is unauthenticated → trusted
  ONLY via HMAC over the raw body (constant-time); an unconfigured scan secret rejects all callbacks.
- **MIME allow-list per kind** — only known image/video/audio/pdf types; executables/HTML rejected
  (415). Size capped (`MEDIA_MAX_UPLOAD_BYTES`, 413 over).
- **Tenant isolation + no IDOR** — `media_assets` is `tenant_id` + RLS (NULL = platform asset);
  every query binds tenant; download is owner/moderator-or-platform scoped → 404 to others.
- **Key layout** embeds tenant + kind + id so the scan callback resolves the owner from a signed
  key (no cross-tenant lookup); keys are parsed with a strict regex (path-traversal-safe).
- **Misconfig fails closed** — presign refuses with no bucket configured.

## Config (AppConfig.media, from env)
`S3_MEDIA_BUCKET`, `AWS_REGION`, `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` (empty ⇒ IAM role),
`S3_ENDPOINT` + `S3_FORCE_PATH_STYLE` (MinIO/LocalStack), `S3_PRESIGN_EXPIRY_SEC`,
`MEDIA_SCAN_SECRET`, `MEDIA_MAX_UPLOAD_BYTES`.

## Tests
Unit (`media.spec.ts`): SigV4 structure + determinism + path-style, object-key round-trip +
traversal rejection, MIME allow-list, tenant-isolation SQL contract. Integration
(`media.integration.spec.ts`, real Postgres + RLS): request→pending→download-withheld→signed
scan-clean→download; forged callback rejected; infected stays blocked; stranger 404; cross-tenant RLS.

## PDF rendering (built)
`pdf/pdf-writer.ts` is a self-contained PDF 1.4 generator (text-only, Helvetica, paginated) — NO
external library, so it's deterministic + unit-tested and adds no native dependency. The payments
module's `DocumentPdfService` renders settlement statements + GST invoices and stores them via
`putGeneratedDocument` (→ clean tenant document, `pdf_media_id` set), behind the `document_pdfs`
flag (default OFF — no S3 write in default flows). Money is rendered via `formatMinor` (no ₹ glyph;
"INR 9,532.50") to stay within WinAnsi.

## EXIF stripping (built)
`image/exif-stripper.ts` removes EXIF/XMP (JPEG APP1) + comments and PNG `eXIf`/text chunks by
SEGMENT/CHUNK surgery — no codec, so it's unit-testable and dependency-free; it preserves the image
data verbatim (privacy: drops embedded GPS). The `ImageProcessingJob` (worker, kv_relay) claims
clean, not-yet-stripped images (`FOR UPDATE SKIP LOCKED`), strips in place, and sets `exif_stripped`
(idempotent).

## Deferred (flagged, not faked)
- **Thumbnail / resize** — genuinely needs an image codec (sharp/libvips); `thumb_s3_key` column +
  the pipeline are ready, only the pixel transform is pending.
- **WebP/HEIC metadata strip** — needs a codec (JPEG/PNG are handled losslessly without one).
- **Presigned POST policy** (signs content-type + size as upload conditions) — stricter than PUT.
- **Real AV integration** (ClamAV / S3 malware scanning) wiring to the callback — the gate is real;
  the scanner is the external producer.
