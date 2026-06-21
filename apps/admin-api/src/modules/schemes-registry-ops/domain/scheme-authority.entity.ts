// apps/admin-api/src/modules/schemes-registry-ops/domain/scheme-authority.entity.ts · pure entity for an issuing
// body (no I/O). The only mutations are renaming / re-levelling / re-regioning; schemes FK authority_id so an
// authority is never hard-deleted. update() throws if nothing actually changes (audit records real changes only).
import { assertAuthorityName, assertLevel, assertUuidOrNull, AuthorityLevel } from './scheme-rules';
import { SchemeAlreadyInStateError } from './schemes-registry.errors';

export interface AuthorityProps {
  id: string; defaultName: string; level: AuthorityLevel | string; regionId: string | null; createdAt?: Date | null;
}
export type AuthorityPatch = { defaultName?: string; level?: string; regionId?: string | null };

export class SchemeAuthority {
  private constructor(private p: AuthorityProps) {}
  static rehydrate(p: AuthorityProps): SchemeAuthority { return new SchemeAuthority(p); }
  get id(): string { return this.p.id; }

  update(patch: AuthorityPatch): { old: Record<string, unknown>; new: Record<string, unknown> } {
    const old: Record<string, unknown> = {}; const next: Record<string, unknown> = {};
    if (patch.defaultName !== undefined) { const v = assertAuthorityName(patch.defaultName); if (v !== this.p.defaultName) { old.defaultName = this.p.defaultName; next.defaultName = v; this.p.defaultName = v; } }
    if (patch.level !== undefined) { const v = assertLevel(patch.level); if (v !== this.p.level) { old.level = this.p.level; next.level = v; this.p.level = v; } }
    if (patch.regionId !== undefined) { const v = assertUuidOrNull(patch.regionId, 'regionId'); if (v !== this.p.regionId) { old.regionId = this.p.regionId; next.regionId = v; this.p.regionId = v; } }
    if (Object.keys(next).length === 0) throw new SchemeAlreadyInStateError('authority', true);
    return { old, new: next };
  }

  get persist(): { defaultName: string; level: string; regionId: string | null } {
    return { defaultName: this.p.defaultName, level: this.p.level, regionId: this.p.regionId };
  }
  toJSON() { return { id: this.p.id, defaultName: this.p.defaultName, level: this.p.level, regionId: this.p.regionId, createdAt: this.p.createdAt ?? null }; }
}
