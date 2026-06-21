// apps/admin-api/src/modules/schemes-registry-ops/services/scheme-crud.service.ts · the registry: authorities
// (list/get/create/update/history) + scheme IDENTITY (list/get/create/updateMeta/activate-deactivate/history).
// One ACID tx per write; every write commits a scheme_registry_changes row + an append-only audit_log row IN THE
// SAME TX (§4). A scheme is created INACTIVE (fail-safe: a half-configured scheme isn't live until explicitly
// activated). category_id is FK-checked against active PLATFORM 'scheme_category' lookup values; authority_id
// against scheme_authorities. Schemes/authorities are never hard-deleted (deactivate retires; FK refs stay valid).
import { Injectable } from '@nestjs/common';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { SchemesRegistryRepository, AuthorityListQuery, SchemeListQuery, ChangeListQuery } from '../repositories/schemes-registry.repository';
import { AuthorityNotFoundError, SchemeNotFoundError, DuplicateSchemeCodeError, SchemeCategoryInvalidError } from '../domain/schemes-registry.errors';
import { assertCode, assertSchemeName, assertAuthorityName, assertLevel, assertUuidOrNull, assertJsonObject, assertUuidArray, assertWindow, assertFeeMinor, assertSourceUrl } from '../domain/scheme-rules';
import { CreateAuthorityDto, UpdateAuthorityDto, CreateSchemeDto, UpdateSchemeMetaDto, SetActiveDto } from '../dto/schemes-registry.dto';

const tsCursor = (createdAt: any, id: string) => Buffer.from(`${createdAt?.toISOString?.() ?? createdAt}|${id}`).toString('base64');

@Injectable()
export class SchemeCrudService {
  constructor(private readonly pool: AdminPool, private readonly audit: AdminAuditWriter, private readonly repo: SchemesRegistryRepository) {}

  private auditEntry(actor: AdminRequestContext, action: string, entityType: string, entityId: string, oldValue: unknown, newValue: unknown, reason: string) {
    return { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null, action, entityType, entityId, oldValue, newValue, reason, ip: actor.ip, requestId: actor.requestId || null };
  }

  /* ---------------- authorities ---------------- */
  async listAuthorities(q: AuthorityListQuery) {
    const items = (await this.repo.listAuthorities(q)).map((a) => a.toJSON());
    const last = items[items.length - 1];
    return { items, nextCursor: items.length === q.limit && last ? tsCursor(last.createdAt, last.id) : null };
  }
  async getAuthority(id: string) {
    const a = await this.repo.getAuthority(id);
    if (!a) throw new AuthorityNotFoundError(id);
    return a.toJSON();
  }
  async createAuthority(actor: AdminRequestContext, dto: CreateAuthorityDto) {
    const defaultName = assertAuthorityName(dto.defaultName);
    const level = assertLevel(dto.level);
    const regionId = assertUuidOrNull(dto.regionId ?? null, 'regionId');
    return this.pool.withTx(async (client) => {
      const ins = await this.repo.insertAuthority(client, { defaultName, level, regionId, actorUserId: actor.userId });
      const newValue = { id: ins.id, defaultName, level, regionId };
      await this.repo.insertChange(client, { entityType: 'authority', entityId: ins.id, action: 'created', oldValue: null, newValue, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, this.auditEntry(actor, 'schemes.authority.created', 'scheme_authority', ins.id, null, newValue, dto.reason));
      return { ...newValue, createdAt: ins.createdAt };
    });
  }
  async updateAuthority(actor: AdminRequestContext, id: string, dto: UpdateAuthorityDto) {
    return this.pool.withTx(async (client) => {
      const authority = await this.repo.getAuthorityForUpdate(client, id);
      if (!authority) throw new AuthorityNotFoundError(id);
      const change = authority.update({ defaultName: dto.defaultName, level: dto.level, regionId: dto.regionId });   // throws if no-op
      const persist = authority.persist;
      await this.repo.updateAuthority(client, id, { ...persist, actorUserId: actor.userId });
      await this.repo.insertChange(client, { entityType: 'authority', entityId: id, action: 'updated', oldValue: change.old, newValue: change.new, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, this.auditEntry(actor, 'schemes.authority.updated', 'scheme_authority', id, change.old, change.new, dto.reason));
      return authority.toJSON();
    });
  }
  async authorityHistory(q: Omit<ChangeListQuery, 'entityType'>) {
    if (!(await this.repo.getAuthority(q.entityId))) throw new AuthorityNotFoundError(q.entityId);
    const items = await this.repo.listChanges({ ...q, entityType: 'authority' });
    const last = items[items.length - 1] as any;
    return { items, nextCursor: items.length === q.limit && last ? tsCursor(last.createdAt, last.id) : null };
  }

  /* ---------------- schemes (identity / lifecycle) ---------------- */
  async listSchemes(q: SchemeListQuery) {
    const items = (await this.repo.listSchemes(q)).map((s) => s.toJSON());
    const last = items[items.length - 1];
    return { items, nextCursor: items.length === q.limit && last ? tsCursor(last.createdAt, last.id) : null };
  }
  async getScheme(id: string) {
    const s = await this.repo.getScheme(id);
    if (!s) throw new SchemeNotFoundError(id);
    return s.toJSON();
  }
  async createScheme(actor: AdminRequestContext, dto: CreateSchemeDto) {
    const code = assertCode(dto.code);
    const defaultName = assertSchemeName(dto.defaultName);
    const authorityId = assertUuidOrNull(dto.authorityId, 'authorityId')!;
    const categoryId = assertUuidOrNull(dto.categoryId, 'categoryId')!;
    const benefitSummary = assertJsonObject(dto.benefitSummary, 'benefit_summary');
    const eligibilityRules = assertJsonObject(dto.eligibilityRules, 'eligibility_rules');
    const requiredDocTypeIds = assertUuidArray(dto.requiredDocTypeIds, 'required_doc_type_ids', 100);
    const applicableRegionIds = assertUuidArray(dto.applicableRegionIds, 'applicable_region_ids', 2000);
    const applicationWindow = assertWindow(dto.applicationWindow ?? null);
    const processingFeeMinor = assertFeeMinor(dto.processingFeeMinor).toString();
    const sourceUrl = assertSourceUrl(dto.sourceUrl ?? null);
    return this.pool.withTx(async (client) => {
      if (!(await this.repo.getAuthorityForUpdate(client, authorityId))) throw new AuthorityNotFoundError(authorityId);
      if (!(await this.repo.isValidCategory(client, categoryId))) throw new SchemeCategoryInvalidError(categoryId);
      if (await this.repo.schemeCodeExists(client, code)) throw new DuplicateSchemeCodeError(code);
      const ins = await this.repo.insertScheme(client, { code, defaultName, authorityId, categoryId, benefitSummary, eligibilityRules, requiredDocTypeIds, applicationWindow, applicableRegionIds, processingFeeMinor, sourceUrl, actorUserId: actor.userId });
      const newValue = { id: ins.id, code, defaultName, authorityId, categoryId, version: 1, isActive: false, processingFeeMinor };
      await this.repo.insertChange(client, { entityType: 'scheme', entityId: ins.id, action: 'created', oldValue: null, newValue, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, this.auditEntry(actor, 'schemes.scheme.created', 'scheme', ins.id, null, newValue, dto.reason));
      return { ...newValue, createdAt: ins.createdAt };
    });
  }
  async updateMeta(actor: AdminRequestContext, id: string, dto: UpdateSchemeMetaDto) {
    return this.pool.withTx(async (client) => {
      const scheme = await this.repo.getSchemeForUpdate(client, id);
      if (!scheme) throw new SchemeNotFoundError(id);
      if (dto.authorityId !== undefined && !(await this.repo.getAuthorityForUpdate(client, dto.authorityId))) throw new AuthorityNotFoundError(dto.authorityId);
      if (dto.categoryId !== undefined && !(await this.repo.isValidCategory(client, dto.categoryId))) throw new SchemeCategoryInvalidError(dto.categoryId);
      const change = scheme.updateMeta({ defaultName: dto.defaultName, authorityId: dto.authorityId, categoryId: dto.categoryId, sourceUrl: dto.sourceUrl });   // throws if no-op
      const p = scheme.persist;
      await this.repo.updateSchemeMeta(client, id, { defaultName: p.defaultName, authorityId: p.authorityId, categoryId: p.categoryId, sourceUrl: p.sourceUrl, actorUserId: actor.userId });
      await this.repo.insertChange(client, { entityType: 'scheme', entityId: id, action: 'updated', oldValue: change.old, newValue: change.new, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, this.auditEntry(actor, 'schemes.scheme.updated', 'scheme', id, change.old, change.new, dto.reason));
      return scheme.toJSON();
    });
  }
  async setActive(actor: AdminRequestContext, id: string, dto: SetActiveDto) {
    return this.pool.withTx(async (client) => {
      const scheme = await this.repo.getSchemeForUpdate(client, id);
      if (!scheme) throw new SchemeNotFoundError(id);
      const change = scheme.setActive(dto.isActive);   // throws SchemeAlreadyInState on no-op
      await this.repo.setSchemeActive(client, id, scheme.isActive, actor.userId);
      await this.repo.insertChange(client, { entityType: 'scheme', entityId: id, action: change.action, oldValue: change.old, newValue: change.new, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, this.auditEntry(actor, `schemes.scheme.${change.action}`, 'scheme', id, change.old, change.new, dto.reason));
      return scheme.toJSON();
    });
  }
  async schemeHistory(q: Omit<ChangeListQuery, 'entityType'>) {
    if (!(await this.repo.getScheme(q.entityId))) throw new SchemeNotFoundError(q.entityId);
    const items = await this.repo.listChanges({ ...q, entityType: 'scheme' });
    const last = items[items.length - 1] as any;
    return { items, nextCursor: items.length === q.limit && last ? tsCursor(last.createdAt, last.id) : null };
  }
}
