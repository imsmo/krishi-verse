// apps/admin-api/src/modules/global-catalogue-ops/services/lookup-vocab-admin.service.ts · the controlled-
// vocabulary registry: list/get lookup TYPES + their PLATFORM values, create a type, create/update a value,
// (de)activate a value, and read change history. One ACID tx per write; every write commits a catalogue_changes
// row + an append-only audit_log row IN THE SAME TX (§4). Values are NEVER hard-deleted — deactivate is the
// controlled-vocab retirement (downstream FK references stay valid). Platform-only: tenant_id IS NULL throughout.
import { Injectable } from '@nestjs/common';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { CatalogueRepository, LookupValueListQuery, ChangeListQuery } from '../repositories/catalogue.repository';
import { LookupTypeNotFoundError, LookupValueNotFoundError, DuplicateCatalogueCodeError } from '../domain/catalogue.errors';
import { assertTypeCode, assertTypeName, assertValueCode, assertValueName, assertMeta, assertSortOrder } from '../domain/lookup-vocab';
import { CreateLookupTypeDto, UpdateLookupTypeDto, CreateLookupValueDto, UpdateLookupValueDto, SetActiveDto } from '../dto/catalogue.dto';

const codeCursor = (code: string) => Buffer.from(String(code)).toString('base64');
const tsCursor = (createdAt: any, id: string) => Buffer.from(`${createdAt?.toISOString?.() ?? createdAt}|${id}`).toString('base64');

@Injectable()
export class LookupVocabAdminService {
  constructor(private readonly pool: AdminPool, private readonly audit: AdminAuditWriter, private readonly repo: CatalogueRepository) {}

  /* ---------------- lookup types ---------------- */
  async listTypes(q: { cursor?: { code: string }; limit: number }) {
    const types = await this.repo.listLookupTypes(q);
    const items = types.map((t) => t.toJSON());
    const last = items[items.length - 1];
    return { items, nextCursor: items.length === q.limit && last ? codeCursor(last.code) : null };
  }
  async getType(code: string) {
    const t = await this.repo.getLookupType(code);
    if (!t) throw new LookupTypeNotFoundError(code);
    return t.toJSON();
  }
  async createType(actor: AdminRequestContext, dto: CreateLookupTypeDto) {
    const code = assertTypeCode(dto.code);
    const defaultName = assertTypeName(dto.defaultName);
    return this.pool.withTx(async (client) => {
      if (await this.repo.getLookupTypeForUpdate(client, code)) throw new DuplicateCatalogueCodeError('lookup type', code);
      await this.repo.insertLookupType(client, { code, defaultName, isTenantExtendable: dto.isTenantExtendable });
      const newValue = { code, defaultName, isTenantExtendable: dto.isTenantExtendable };
      await this.repo.insertChange(client, { entityType: 'lookup_type', entityId: code, action: 'created', oldValue: null, newValue, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null, action: 'catalogue.lookup_type.created', entityType: 'lookup_type', entityId: code, oldValue: null, newValue, reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null });
      return newValue;
    });
  }
  async updateType(actor: AdminRequestContext, code: string, dto: UpdateLookupTypeDto) {
    return this.pool.withTx(async (client) => {
      const type = await this.repo.getLookupTypeForUpdate(client, code);
      if (!type) throw new LookupTypeNotFoundError(code);
      const change = type.rename(dto.defaultName);
      await this.repo.updateLookupTypeName(client, code, change.new.defaultName);
      await this.repo.insertChange(client, { entityType: 'lookup_type', entityId: code, action: 'renamed', oldValue: change.old, newValue: change.new, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null, action: 'catalogue.lookup_type.renamed', entityType: 'lookup_type', entityId: code, oldValue: change.old, newValue: change.new, reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null });
      return type.toJSON();
    });
  }

  /* ---------------- lookup values (platform) ---------------- */
  async listValues(q: LookupValueListQuery) {
    if (!(await this.repo.getLookupType(q.typeCode))) throw new LookupTypeNotFoundError(q.typeCode);
    const items = (await this.repo.listLookupValues(q)).map((v) => v.toJSON());
    const last = items[items.length - 1];
    return { items, nextCursor: items.length === q.limit && last ? tsCursor(last.createdAt, last.id) : null };
  }
  async getValue(id: string) {
    const v = await this.repo.getLookupValue(id);
    if (!v) throw new LookupValueNotFoundError(id);
    return v.toJSON();
  }
  async createValue(actor: AdminRequestContext, dto: CreateLookupValueDto) {
    const typeCode = assertTypeCode(dto.typeCode);
    const code = assertValueCode(dto.code);
    const defaultName = assertValueName(dto.defaultName);
    const meta = assertMeta(dto.meta);
    const sortOrder = assertSortOrder(dto.sortOrder);
    if (!(await this.repo.getLookupType(typeCode))) throw new LookupTypeNotFoundError(typeCode);
    return this.pool.withTx(async (client) => {
      if (await this.repo.platformValueCodeExists(client, typeCode, code)) throw new DuplicateCatalogueCodeError('lookup value', code);
      const { id, createdAt } = await this.repo.insertLookupValue(client, { typeCode, code, defaultName, meta, sortOrder, actorUserId: actor.userId });
      const newValue = { id, typeCode, code, defaultName, meta, sortOrder, isActive: true };
      await this.repo.insertChange(client, { entityType: 'lookup_value', entityId: id, action: 'created', oldValue: null, newValue, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null, action: 'catalogue.lookup_value.created', entityType: 'lookup_value', entityId: id, oldValue: null, newValue, reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null });
      return { ...newValue, createdAt };
    });
  }
  async updateValue(actor: AdminRequestContext, id: string, dto: UpdateLookupValueDto) {
    return this.pool.withTx(async (client) => {
      const value = await this.repo.getLookupValueForUpdate(client, id);
      if (!value) throw new LookupValueNotFoundError(id);
      const change = value.update({ defaultName: dto.defaultName, meta: dto.meta, sortOrder: dto.sortOrder });   // throws CatalogueAlreadyInState if no-op
      const persist = value.persist;
      await this.repo.updateLookupValue(client, id, { defaultName: persist.defaultName, meta: persist.meta, sortOrder: persist.sortOrder, actorUserId: actor.userId });
      await this.repo.insertChange(client, { entityType: 'lookup_value', entityId: id, action: change.action, oldValue: change.old, newValue: change.new, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null, action: `catalogue.lookup_value.${change.action}`, entityType: 'lookup_value', entityId: id, oldValue: change.old, newValue: change.new, reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null });
      return value.toJSON();
    });
  }
  async setValueActive(actor: AdminRequestContext, id: string, dto: SetActiveDto) {
    return this.pool.withTx(async (client) => {
      const value = await this.repo.getLookupValueForUpdate(client, id);
      if (!value) throw new LookupValueNotFoundError(id);
      const change = value.setActive(dto.isActive);   // throws CatalogueAlreadyInState on no-op
      await this.repo.setLookupValueActive(client, id, value.isActive, actor.userId);
      await this.repo.insertChange(client, { entityType: 'lookup_value', entityId: id, action: change.action, oldValue: change.old, newValue: change.new, reason: dto.reason, actorUserId: actor.userId });
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null, action: `catalogue.lookup_value.${change.action}`, entityType: 'lookup_value', entityId: id, oldValue: change.old, newValue: change.new, reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null });
      return value.toJSON();
    });
  }

  async valueHistory(q: Omit<ChangeListQuery, 'entityType'>) {
    if (!(await this.repo.getLookupValue(q.entityId))) throw new LookupValueNotFoundError(q.entityId);
    const items = await this.repo.listChanges({ ...q, entityType: 'lookup_value' });
    const last = items[items.length - 1] as any;
    return { items, nextCursor: items.length === q.limit && last ? tsCursor(last.createdAt, last.id) : null };
  }
}
