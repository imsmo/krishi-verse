// modules/catalogue/controllers/v1/attributes.controller.ts · attributes (+options) for a category.
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../../core/auth/permissions.guard';
import { Public } from '../../../../core/auth/public.decorator';
import { ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { AttributeDefinitionService } from '../../services/attribute-definition.service';
import { QueryAttributesForCategorySchema, QueryAttributesForCategoryDto } from '../../dto/query-attribute-definition.dto';

@Controller({ path: 'attributes', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard)
export class AttributesController {
  constructor(private readonly attrs: AttributeDefinitionService) {}
  @Public() @Get()
  forCategory(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryAttributesForCategorySchema) q: QueryAttributesForCategoryDto) {
    return this.attrs.forCategory(ctx.tenantId, q.categoryId, q.filtersOnly).then((data) => ({ data }));
  }
}
