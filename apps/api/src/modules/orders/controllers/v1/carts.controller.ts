// modules/orders/controllers/v1/carts.controller.ts · the buyer's cart (owner-scoped).
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { ZodBody } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { CartService } from '../../services/cart.service';
import { AddToCartSchema, AddToCartDto, UpdateCartItemSchema, UpdateCartItemDto } from '../../dto/create-cart-item.dto';
import { OrderPermissions } from '../../policies/orders.policies';

@Controller({ path: 'cart', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions(OrderPermissions.Create)
export class CartsController {
  constructor(private readonly cart: CartService) {}
  @Get() get(@CurrentContext() ctx: RequestContext) { return this.cart.getCart(ctx.tenantId, ctx.userId).then((data) => ({ data })); }
  @Post('items') add(@CurrentContext() ctx: RequestContext, @ZodBody(AddToCartSchema) dto: AddToCartDto) { return this.cart.addItem(ctx.tenantId, ctx.userId, dto).then((data) => ({ data })); }
  @Patch('items/:listingId') update(@CurrentContext() ctx: RequestContext, @Param('listingId') listingId: string, @ZodBody(UpdateCartItemSchema) dto: UpdateCartItemDto) { return this.cart.updateItem(ctx.tenantId, ctx.userId, listingId, dto.quantity).then((data) => ({ data })); }
  @Delete('items/:listingId') remove(@CurrentContext() ctx: RequestContext, @Param('listingId') listingId: string) { return this.cart.removeItem(ctx.tenantId, ctx.userId, listingId).then((data) => ({ data })); }
  @Delete() clear(@CurrentContext() ctx: RequestContext) { return this.cart.clear(ctx.tenantId, ctx.userId).then((data) => ({ data })); }
}
