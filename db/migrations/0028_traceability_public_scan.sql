-- ============================================================================
-- MIGRATION 0028 — TRACEABILITY PUBLIC QR SCAN (M-trace, PRD §16.3)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction.
-- trace_lots + trace_events are tenant-scoped + RLS-protected (0012/0014). The farm-to-fork QR is scanned by
-- an ANONYMOUS consumer with NO tenant context, so a normal RLS read would see nothing. This SECURITY DEFINER
-- function is the single, controlled escape hatch: it runs as its owner (bypassing RLS), is looked up ONLY by
-- the unguessable public qr_token, and returns a FIXED, NON-PII projection (provenance + event timeline). It
-- NEVER returns tenant_id, the farmer's user id / phone, or any other PII. EXECUTE is granted to kv_app only.
-- ============================================================================
CREATE OR REPLACE FUNCTION trace_scan(p_qr_token text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
           'qrToken',        l.qr_token,
           'listingId',      l.listing_id,
           'declaredInputs', l.declared_inputs,
           'certificateIds', l.certificate_ids,
           'anchored',       (l.blockchain_anchor IS NOT NULL),
           'createdAt',      l.created_at,
           'events', COALESCE((
             SELECT jsonb_agg(jsonb_build_object('eventCode', e.event_code, 'meta', e.meta, 'at', e.created_at) ORDER BY e.created_at)
             FROM trace_events e WHERE e.trace_lot_id = l.id
           ), '[]'::jsonb)
         )
  FROM trace_lots l
  WHERE l.qr_token = p_qr_token AND l.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION trace_scan(text) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kv_app') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION trace_scan(text) TO kv_app';
  END IF;
END $$;
