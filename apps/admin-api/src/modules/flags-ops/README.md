# flags-ops (admin-api · god-mode plane, Law 10 + Law 11)

The platform **feature-flag** control plane. It is the only authorised WRITER of the GLOBAL `feature_flags` table
(0002) that the runtime evaluator in `apps/api` (`core/feature-flags/flags.service.ts`) READS. It gives platform
SRE/release staff the controls to ship every feature behind a flag (default OFF), ramp it with a deterministic
percentage rollout + targeting allowlist, and pull the **kill-switch** in an incident (disable + lock).

## Endpoints (URI-versioned, all admin-authed)
| Method | Path | Owner perm | Elevation |
|---|---|---|---|
| GET | `/v1/flags` · `/flags/:key` | `flags.read` | — (keyset registry + detail) |
| GET | `/v1/flags/:key/history` | `flags.read` | — (change timeline, keyset) |
| POST | `/v1/flags` | `flags.manage` | **FIDO2 + step-up** (create, default OFF) |
| PATCH | `/v1/flags/:key` | `flags.manage` | **FIDO2 + step-up** (enable/disable/set_rollout/set_targeting/kill/unlock) |

## What it owns
- **Registry** over `feature_flags` (0002): create a flag (always **OFF** — `is_enabled=false`, Law 10), browse the
  registry (keyset over `(created_at, key)` — the table's PK is `key`, no `id`), read a single flag + its history.
- **Percent rollout + targeting**: `set_rollout` sets the deterministic 0..100 percentage; `set_targeting` replaces
  the allowlist (`tenant_ids`/`plans`/`countries`). Both are validated + bounded in the domain and persisted in the
  **snake_case `rules` shape the runtime evaluator reads** (camelCase DTO → snake_case rules).
- **On/off + KILL-SWITCH** (Law 10): `enable`/`disable` flip `is_enabled`; **`kill`** disables for everyone AND sets
  `feature_flags.is_locked=true` so no operator can re-enable / re-ramp / re-target until an explicit `unlock`
  (which does NOT re-enable). The runtime evaluator ignores `is_locked` (it only reads `is_enabled`/`rollout_pct`/
  `rules`) — the lock is an admin-plane safety guard.
- **Change history** over `feature_flag_changes` (0036): append-only `created/enabled/disabled/rollout_changed/
  targeting_changed/killed/unlocked` with old→new diffs + reason + actor, for the console timeline.

Resolution parity: `domain/rollout.ts#isEnabledFor` mirrors the runtime evaluator byte-for-byte (same FNV-1a
bucket, same allowlist-then-percentage order) so the console can preview who a flag is on for; unit-tested.

## Threats considered (§4 + Law 10)
- **No privilege escalation (Law 11).** `flags.manage`/`flags.read` are PLATFORM owner perms (roles
  `platform_flags_ops`/`platform_flags_viewer` = SRE/release); never tenant-assignable, no plane bleed
  (unit-tested). A tenant can never flip a global flag.
- **JIT elevation + audit.** Every mutation needs a verified admin JWT + the owner perm + FIDO2 hardware-key +
  step-up; guards THROW. A global flag flip affects every tenant, so it is treated as consequential. Each change
  writes a `feature_flag_changes` row + an `audit_log` row IN THE SAME TX (actor, old→new, reason, ip, request_id);
  a refused change (locked flag / unlock-when-unlocked / bad rollout) writes nothing.
- **Kill-switch is real (Law 10).** `kill` is always permitted (it only reduces exposure) and LOCKS the flag;
  re-enable/ramp/target are refused until `unlock` (separate, audited). `disable` is likewise always permitted.
  Fail-safe direction: turning a feature OFF is never blocked.
- **Fail closed / bounded.** Unknown flag → 404 (a typo can't silently target the wrong flag); `rollout_pct` is an
  int 0..100; targeting arrays are size-capped (tenant_ids ≤ 1000, plans ≤ 200, countries ≤ 300) and charset-
  validated (uuid / `^[a-z0-9_]{1,40}$` / ISO-3166 alpha-2); flag keys match `^[a-z][a-z0-9_.]{1,79}$` (linear,
  ReDoS-safe); LIKE-prefix metacharacters are escaped; zod `.strict()` discriminated union rejects unknown keys /
  cross-action fields; keyset pagination (never OFFSET), max LIMIT 100; mandatory reason on every mutation.
- **Global table, role-isolated.** `feature_flags` + `feature_flag_changes` have no `tenant_id` (platform/god-mode)
  → operated only by RLS-bypassing `kv_admin`, every action audited (consistent with recon-monitor's god-mode
  tables; `verify-rls-coverage.js` confirms no tenant table is left unprotected).

## Tests
- Unit (`flags-ops.spec.ts`): entity invariants + kill-switch lock; rollout/targeting validation + bounds; rollout
  evaluator PARITY with the runtime; owner-RBAC + no-escalation; DTO discriminated-union validation; services
  proving change-row + audit-in-tx, lock enforcement (refused write audits nothing), and 404.
- Integration (`flags-ops.integration.spec.ts`, real Postgres, gated on `DATABASE_ADMIN_URL`): create→enable→ramp→
  kill — asserting `feature_flags` state + lock, that a locked flag refuses re-enable, the `feature_flag_changes`
  timeline, and the `audit_log` rows.
