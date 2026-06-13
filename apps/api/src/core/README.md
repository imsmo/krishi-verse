# core/ — platform plumbing (no business logic here, ever)
tenancy-context: resolves tenant from JWT+domain, sets app.tenant_id per txn (Law 1)
auth+rbac:       OTP/JWT, dynamic roles/permissions from DB
outbox:          transactional event writer (Law 4)
idempotency:     Idempotency-Key middleware (Law 3)
i18n:            key-based translations, language negotiation
audit:           audit_log writer for admin actions
media:           S3 presign, scan pipeline hooks, media_links
feature-flags:   DB-backed flags + % rollout (Law 10)
search:          OpenSearch client + index builders (consumes outbox)
database:        pg pool via RDS-proxy, RLS session, uuid_v7_time helpers
