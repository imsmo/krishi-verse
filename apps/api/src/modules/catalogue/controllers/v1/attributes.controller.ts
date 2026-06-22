// modules/catalogue/controllers/v1/attributes.controller.ts · read attributes for a category (hydrated defs +
// options), the raw category-attribute BINDINGS, and an attribute's dropdown OPTIONS. All GLOBAL reads (browse),
// validate→delegate only; global writes live in apps/admin-api (Law 11).
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../../core/auth/permissions.guard';
import { Public } from '../../../../core/auth/public.decorator';
import { ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { AttributeDefinitionService } from '../../services/attribute-definition.service';
import { AttributeOptionService } from '../../services/attribute-option.service';
import { CategoryAttributeService } from '../../services/category-attribute.service';
import { QueryAttributesForCategorySchema, QueryAttributesForCategoryDto } from '../../dto/query-attribute-definition.dto';
import { QueryAttributeOptionSchema, QueryAttributeOptionDto } from '../../dto/query-attribute-option.dto';
import { QueryCategoryAttributeSchema, QueryCategoryAttributeDto } from '../../dto/query-category-attribute.dto';

@Controller({ path: 'attributes', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard)
export class AttributesController {
  constructor(
    private readonly attrs: AttributeDefinitionService,
    private readonly options: AttributeOptionService,
    private readonly bindings: CategoryAttributeService,
  ) {}

  @Public() @Get()
  forCategory(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryAttributesForCategorySchema) q: QueryAttributesForCategoryDto) {
    return this.attrs.forCategory(ctx.tenantId, q.categoryId, q.filtersOnly).then((data) => ({ data }));
  }

  @Public() @Get('options')
  optionsFor(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryAttributeOptionSchema) q: QueryAttributeOptionDto) {
    return this.options.listForAttribute(ctx.tenantId, q.attributeId, q.activeOnly).then((data) => ({ data }));
  }

  @Public() @Get('bindings')
  bindingsFor(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryCategoryAttributeSchema) q: QueryCategoryAttributeDto) {
    return this.bindings.listForCategory(ctx.tenantId, q.categoryId).then((data) => ({ data }));
  }
}
