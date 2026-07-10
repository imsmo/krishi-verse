// modules/identity/services/onboarding.service.ts · self-serve role onboarding (KV-BL-066).
// Today an OTP-verified user has a bare `users` row and NO tenant role — becoming a farmer or
// buyer required an admin (POST /v1/rbac/assignments, gated by identity.approve; UserTenantRoleService
// .assign()). This closes that pilot-blocking gap for the two roles that are safe to self-grant.
//
// Tenant resolution: the caller's tenantId comes from RequestContext (ctx.tenantId), exactly like
// every other identity self-service endpoint (auth.controller change-phone, roles.controller reads).
// It was already resolved by tenant-context.middleware from the JWT `tid` claim minted at
// POST /v1/auth/verify (VerifyOtpDto.tenantId — the client supplies/knows its tenant at login; the
// pilot runs a single tenant). There is no tenant-selection ambiguity to solve here and therefore no
// new PILOT_DEFAULT_TENANT_ID env var: the user is already IN a tenant by the time this endpoint runs.
//
// Pilot role scope (Law: least privilege at launch — grow SELF_SERVE_ALLOWED as more roles graduate
// to self-serve GA): only farmer + customer. Every other code is rejected with a typed 403 that
// distinguishes WHY (platform role / invite-only / not yet GA at pilot / unknown) — see
// SelfServeRoleNotEligibleError. Platform roles additionally mirror the Law-11 guard already in
// UserTenantRoleService.assign() (never assignable via any tenant-facing endpoint).
//
// Idempotent by construction (Law 3): re-POSTing the same role for the same user/tenant is a pure
// no-op that returns the SAME 200 + current effective roles — no duplicate audit row, no duplicate
// outbox event. Belt-and-suspenders: the controller ALSO requires an Idempotency-Key header (module
// convention for mutating POSTs) so a network retry of the very FIRST grant can't double-fire either.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { RoleCacheService } from '../../../core/rbac/role-cache.service';
import { uuidv7 } from '../../../core/database/uuid.util';
import { RoleNotFoundError, SelfServeRoleNotEligibleError } from '../domain/identity.errors';
import { UserTenantRole } from '../domain/user-tenant-role.entity';
import { UserTenantRoleRepository } from '../repositories/user-tenant-role.repository';
import { RoleRepository } from '../repositories/role.repository';
import { OnboardRoleDto } from '../dto/onboard-role.dto';

/** Self-serve-safe AT PILOT (screens 04/433 role picker). Everything else below is either
 *  invite-only forever, or self-serve-safe by design canon but not yet turned on for this pilot. */
const SELF_SERVE_ALLOWED = new Set(['farmer', 'customer']);

/** Roles that need a human to vet/invite even once self-serve reaches broader GA — never just a
 *  checkbox in an app (sardar/vet/warehouse/staff per the role-picker design canon, plus the other
 *  approval-heavy tenant-ops roles). Platform roles are handled separately (role.isPlatform). */
const INVITE_ONLY = new Set([
  'tenant_admin', 'tenant_staff', 'support_agent', 'auditor', 'ambassador',
  'fpo_coordinator', 'ai_ops', 'vet', 'banker', 'insurance_agent', 'gov_officer', 'sardar',
]);

export interface OnboardRoleResult {
  roleCode: string;
  alreadyGranted: boolean;
  roles: string[]; // all currently-active role codes for the caller in this tenant, post-grant
}

@Injectable()
export class OnboardingService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    private readonly audit: AuditWriter,
    private readonly roleCache: RoleCacheService,
    private readonly utr: UserTenantRoleRepository,
    private readonly roles: RoleRepository,
  ) {}

  async grantRole(tenantId: string, userId: string, dto: OnboardRoleDto, ip: string | null): Promise<OnboardRoleResult> {
    const roleCode = dto.role;
    const role = await this.roles.findByCode(tenantId, roleCode);

    if (!SELF_SERVE_ALLOWED.has(roleCode)) {
      if (!role) throw new SelfServeRoleNotEligibleError(roleCode, 'unknown_role');
      if (role.isPlatform) throw new SelfServeRoleNotEligibleError(roleCode, 'platform_role');
      if (INVITE_ONLY.has(roleCode)) throw new SelfServeRoleNotEligibleError(roleCode, 'invite_only');
      throw new SelfServeRoleNotEligibleError(roleCode, 'not_pilot_ga');
    }
    // seed drift guard: farmer/customer are seeded in 0004_roles_permissions.sql and must exist —
    // if they don't, that's a deployment problem, not a client error.
    if (!role) throw new RoleNotFoundError(roleCode);

    const existing = await this.utr.findExisting(tenantId, userId, role.id);
    let alreadyGranted = !!existing;

    if (!existing) {
      try {
        await this.uow.run(tenantId, async (tx) => {
          // requiresApproval:false is deliberate here — this is the self-serve pilot grant path,
          // NOT the admin-assign path (UserTenantRoleService.assign, which honours role.requiresApproval
          // and would leave `farmer` pending). Self-serve grants are immediately active; the separate
          // requires_kyc flag / kyc_status column (left 'none' by UserTenantRole.assign) still governs
          // any KYC-gated action later — this endpoint does not claim KYC has happened.
          const utr = UserTenantRole.assign({
            id: uuidv7(), userId, tenantId, roleId: role.id, roleCode: role.code, requiresApproval: false,
          });
          await this.utr.insert(tx, utr);
          await this.outbox.write(tx, {
            tenantId, aggregateType: 'user_tenant_role', aggregateId: utr.id,
            eventType: 'identity.role_selfserve_granted',
            payload: { v: 1, userId, tenantId, roleCode: role.code },
          });
          await this.audit.write(tx, {
            tenantId, actorUserId: userId, action: 'role.selfserve_granted',
            entityType: 'user_tenant_role', entityId: utr.id,
            newValue: { userId, roleCode: role.code, active: true }, ip,
          });
        }, { userId });
      } catch (e: any) {
        if (e?.code === '23505') alreadyGranted = true; // unique(user,tenant,role) race — granted concurrently
        else throw e;
      }
      if (!alreadyGranted) await this.roleCache.invalidate(userId, tenantId);
    }

    const rows = await this.utr.list(tenantId, { userId, pendingOnly: false });
    const activeRoles = rows.filter((r: any) => r.is_active).map((r: any) => r.role_code as string);
    return { roleCode: role.code, alreadyGranted, roles: activeRoles };
  }
}
