-- 0065_inprocess_wallet_role_elevation.sql
-- FIX (S6 device-test, found by demo-seed step 10 "pays"): the payment/payout webhook
-- posts to the ledger via the IN-PROCESS wallet (InProcessWalletClient — the active money
-- path at shard_count=1; WALLET_SERVICE is bound to it unconditionally). That client runs
-- on the SAME connection as the rest of the API, i.e. as the login role kv_app.
--
-- But 0014 deliberately locked the ledger down:
--     REVOKE ALL ON wallet_accounts, ledger_entries, ledger_transactions FROM kv_app;
--     GRANT  SELECT ON ...                                               TO   kv_app;   -- read only
--     GRANT  SELECT, INSERT[, UPDATE] ON ...                             TO   kv_wallet; -- the writer
-- So kv_app can READ the ledger but never WRITE it. With the wallet running in-process on
-- kv_app, EVERY payment capture / payout confirmation hit:
--     "permission denied for table ledger_transactions"
-- i.e. no money could ever move — in dev OR in the pilot (which also runs shard_count=1,
-- in-process). This is a real production-blocking bug, not a local-only quirk.
--
-- We must NOT simply grant kv_app write access to the ledger — that would dissolve the
-- "only the wallet writes money" invariant (Law 2): any stray app query (or an injection)
-- could then post to the ledger directly. Instead we keep the boundary and elevate ONLY the
-- wallet client's writes:
--   • make kv_app a MEMBER of kv_wallet (so it MAY assume that role), and
--   • the wallet client wraps its ledger writes in `SET LOCAL ROLE kv_wallet` … `RESET ROLE`
--     (see wallet.client.inprocess.ts). Ordinary app SQL still runs as kv_app and still
--     cannot touch the ledger; only the wallet post transiently elevates.
--
-- This mirrors the intended separation without a second set of DB credentials. Fully
-- isolating the wallet into its own service/credential (apps/wallet-service, kv_wallet
-- login) remains the future hardening once shard_count > 1.
--
-- Idempotent: GRANT role membership is a no-op if already granted. kv_wallet + kv_app both
-- exist (created before 0014, which already grants privileges to both).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kv_wallet')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kv_app') THEN
    EXECUTE 'GRANT kv_wallet TO kv_app';
  END IF;
END $$;
