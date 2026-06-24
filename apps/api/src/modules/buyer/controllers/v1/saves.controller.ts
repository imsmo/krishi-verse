// modules/buyer/controllers/v1/saves.controller.ts · the buyer's favourites/watchlist.
// POST   buyer/saves                       — save a listing/seller/product/… (idempotent)
// GET    buyer/saves?entityType=&cursor=   — the caller's saves (keyset)
// DELETE buyer/saves/:entityType/:entityId — un-save
// Owner = the caller's own userId (from the token); a user only ever touches their OWN saves (no IDOR).
import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../../core/auth/permissions.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { SavedService } from '../../services/saved.service';
import { SaveItemSchema, SaveItemDto, SavedQuerySchema, SavedQueryDto } from '../../dto/saved.dto';

@Controller({ path: 'buyer/saves', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard)
export class SavesController {
  constructor(private readonly svc: SavedService) {}

  @Post()
  save(@CurrentContext() ctx: RequestContext, @ZodBody(SaveItemSchema) dto: SaveItemDto) {
    return this.svc.save(ctx.tenantId, ctx.userId, dto.entityType, dto.entityId).then((data) => ({ data }));
  }

  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(SavedQuerySchema) q: SavedQueryDto) {
    return this.svc.listItems(ctx.tenantId, ctx.userId, q).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  @Delete(':entityType/:entityId')
  unsave(@CurrentContext() ctx: RequestContext, @Param('entityType') entityType: string, @Param('entityId') entityId: string) {
    return this.svc.unsave(ctx.tenantId, ctx.userId, entityType, entityId).then((data) => ({ data }));
  }
}
