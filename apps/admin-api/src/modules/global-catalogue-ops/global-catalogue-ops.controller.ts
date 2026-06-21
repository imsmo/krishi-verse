// apps/admin-api/src/modules/global-catalogue-ops/global-catalogue-ops.controller.ts · god-mode PLATFORM master-
// taxonomy registry (Law 11). Every route: AdminAuthGuard + OwnerPermissionsGuard. Reads need catalogue.read; every
// MUTATION (a master-taxonomy change ripples into every tenant's catalogue) needs catalogue.manage + HardwareKeyGuard
// (FIDO2) + StepUpReauthGuard. validate (zod) → authorize → delegate ONLY. Static/sub routes are declared before the
// :id params so Nest matches them first. Two registries under one plane: lookup vocabularies + the category tree.
import { Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AdminAuthGuard, AdminRequestContext } from '../../core/auth/admin-auth.guard';
import { HardwareKeyGuard } from '../../core/auth/hardware-key.guard';
import { StepUpReauthGuard } from '../../core/auth/step-up-reauth.guard';
import { OwnerPermissionsGuard, RequireOwnerPermission, OwnerPermissions } from '../../core/rbac/owner-roles';
import { ZodBody, ZodQuery } from '../../core/http/zod.pipe';
import { LookupVocabAdminService } from './services/lookup-vocab-admin.service';
import { CategoriesAdminService } from './services/categories-admin.service';
import {
  CreateLookupTypeSchema, CreateLookupTypeDto, UpdateLookupTypeSchema, UpdateLookupTypeDto,
  CreateLookupValueSchema, CreateLookupValueDto, UpdateLookupValueSchema, UpdateLookupValueDto,
  CreateCategorySchema, CreateCategoryDto, UpdateCategorySchema, UpdateCategoryDto, MoveCategorySchema, MoveCategoryDto,
  SetActiveSchema, SetActiveDto,
  QueryLookupTypesSchema, QueryLookupTypesDto, QueryLookupValuesSchema, QueryLookupValuesDto,
  QueryCategoriesSchema, QueryCategoriesDto, QueryChangesSchema, QueryChangesDto,
} from './dto/catalogue.dto';

const admin = (req: any): AdminRequestContext => req.admin;
const decodeCodeCursor = (c?: string) => (c ? { code: Buffer.from(c, 'base64').toString() } : undefined);
const decodeTsCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };
const bool = (v?: string) => (v === undefined ? undefined : v === 'true');

@Controller({ path: 'catalogue', version: '1' })
@UseGuards(AdminAuthGuard, OwnerPermissionsGuard)
export class GlobalCatalogueOpsController {
  constructor(
    private readonly vocab: LookupVocabAdminService,
    private readonly categories: CategoriesAdminService,
  ) {}

  /* ======================= lookup types ======================= */
  @Get('lookup-types') @RequireOwnerPermission(OwnerPermissions.CatalogueRead)
  listTypes(@ZodQuery(QueryLookupTypesSchema) q: QueryLookupTypesDto) {
    return this.vocab.listTypes({ cursor: decodeCodeCursor(q.cursor), limit: q.limit }).then((r) => ({ data: r.items, meta: { nextCursor: r.nextCursor } }));
  }
  @Post('lookup-types') @RequireOwnerPermission(OwnerPermissions.CatalogueManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  createType(@Req() req: any, @ZodBody(CreateLookupTypeSchema) dto: CreateLookupTypeDto) {
    return this.vocab.createType(admin(req), dto).then((data) => ({ data }));
  }
  @Get('lookup-types/:code') @RequireOwnerPermission(OwnerPermissions.CatalogueRead)
  getType(@Param('code') code: string) { return this.vocab.getType(code).then((data) => ({ data })); }
  @Patch('lookup-types/:code') @RequireOwnerPermission(OwnerPermissions.CatalogueManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  updateType(@Req() req: any, @Param('code') code: string, @ZodBody(UpdateLookupTypeSchema) dto: UpdateLookupTypeDto) {
    return this.vocab.updateType(admin(req), code, dto).then((data) => ({ data }));
  }

  /* ======================= lookup values (platform) ======================= */
  @Get('lookup-values') @RequireOwnerPermission(OwnerPermissions.CatalogueRead)
  listValues(@ZodQuery(QueryLookupValuesSchema) q: QueryLookupValuesDto) {
    return this.vocab.listValues({ typeCode: q.typeCode, isActive: bool(q.isActive), cursor: decodeTsCursor(q.cursor), limit: q.limit }).then((r) => ({ data: r.items, meta: { nextCursor: r.nextCursor } }));
  }
  @Post('lookup-values') @RequireOwnerPermission(OwnerPermissions.CatalogueManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  createValue(@Req() req: any, @ZodBody(CreateLookupValueSchema) dto: CreateLookupValueDto) {
    return this.vocab.createValue(admin(req), dto).then((data) => ({ data }));
  }
  @Get('lookup-values/:id') @RequireOwnerPermission(OwnerPermissions.CatalogueRead)
  getValue(@Param('id') id: string) { return this.vocab.getValue(id).then((data) => ({ data })); }
  @Get('lookup-values/:id/history') @RequireOwnerPermission(OwnerPermissions.CatalogueRead)
  valueHistory(@Param('id') id: string, @ZodQuery(QueryChangesSchema) q: QueryChangesDto) {
    return this.vocab.valueHistory({ entityId: id, cursor: decodeTsCursor(q.cursor), limit: q.limit }).then((r) => ({ data: r.items, meta: { nextCursor: r.nextCursor } }));
  }
  @Patch('lookup-values/:id') @RequireOwnerPermission(OwnerPermissions.CatalogueManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  updateValue(@Req() req: any, @Param('id') id: string, @ZodBody(UpdateLookupValueSchema) dto: UpdateLookupValueDto) {
    return this.vocab.updateValue(admin(req), id, dto).then((data) => ({ data }));
  }
  @Post('lookup-values/:id/active') @RequireOwnerPermission(OwnerPermissions.CatalogueManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  setValueActive(@Req() req: any, @Param('id') id: string, @ZodBody(SetActiveSchema) dto: SetActiveDto) {
    return this.vocab.setValueActive(admin(req), id, dto).then((data) => ({ data }));
  }

  /* ======================= categories (tree) ======================= */
  @Get('categories') @RequireOwnerPermission(OwnerPermissions.CatalogueRead)
  listCategories(@ZodQuery(QueryCategoriesSchema) q: QueryCategoriesDto) {
    return this.categories.list({ parentId: q.parentId, isActive: bool(q.isActive), commerceKind: q.commerceKind, cursor: decodeTsCursor(q.cursor), limit: q.limit }).then((r) => ({ data: r.items, meta: { nextCursor: r.nextCursor } }));
  }
  @Post('categories') @RequireOwnerPermission(OwnerPermissions.CatalogueManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  createCategory(@Req() req: any, @ZodBody(CreateCategorySchema) dto: CreateCategoryDto) {
    return this.categories.create(admin(req), dto).then((data) => ({ data }));
  }
  @Get('categories/:id') @RequireOwnerPermission(OwnerPermissions.CatalogueRead)
  getCategory(@Param('id') id: string) { return this.categories.get(id).then((data) => ({ data })); }
  @Get('categories/:id/children') @RequireOwnerPermission(OwnerPermissions.CatalogueRead)
  children(@Param('id') id: string, @ZodQuery(QueryChangesSchema) q: QueryChangesDto) {
    return this.categories.children(id, q.limit).then((r) => ({ data: r.items, meta: { nextCursor: r.nextCursor } }));
  }
  @Get('categories/:id/history') @RequireOwnerPermission(OwnerPermissions.CatalogueRead)
  categoryHistory(@Param('id') id: string, @ZodQuery(QueryChangesSchema) q: QueryChangesDto) {
    return this.categories.history({ entityId: id, cursor: decodeTsCursor(q.cursor), limit: q.limit }).then((r) => ({ data: r.items, meta: { nextCursor: r.nextCursor } }));
  }
  @Patch('categories/:id') @RequireOwnerPermission(OwnerPermissions.CatalogueManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  updateCategory(@Req() req: any, @Param('id') id: string, @ZodBody(UpdateCategorySchema) dto: UpdateCategoryDto) {
    return this.categories.update(admin(req), id, dto).then((data) => ({ data }));
  }
  @Post('categories/:id/move') @RequireOwnerPermission(OwnerPermissions.CatalogueManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  moveCategory(@Req() req: any, @Param('id') id: string, @ZodBody(MoveCategorySchema) dto: MoveCategoryDto) {
    return this.categories.move(admin(req), id, dto).then((data) => ({ data }));
  }
  @Post('categories/:id/active') @RequireOwnerPermission(OwnerPermissions.CatalogueManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  setCategoryActive(@Req() req: any, @Param('id') id: string, @ZodBody(SetActiveSchema) dto: SetActiveDto) {
    return this.categories.setActive(admin(req), id, dto).then((data) => ({ data }));
  }
}
