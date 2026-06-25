# Runbook: suspected tenant data leak / DPDP breach — SEV0

1. Declare SEV0; preserve evidence (do not delete logs). Notify DPO + legal.
2. Confirm scope: which tenant(s)/users? Check audit_log for the access pattern; confirm RLS wasn't bypassed
   (`verify-rls-coverage.js` — every tenant table FORCED). A non-member read returning data (not 404) = the bug.
3. Contain: revoke the leaking credential/role; kill-switch the offending feature flag; if RLS gap, hotfix the
   migration (ENABLE+FORCE+policy) and redeploy.
4. **DPDP §8(6):** open a `data_breaches` record (admin-api compliance-ops); notify the Data Protection Board +
   affected data principals within the statutory window. Legal owns the notice.
5. Postmortem + regression test (tenant-isolation spec covering the leaked path).
