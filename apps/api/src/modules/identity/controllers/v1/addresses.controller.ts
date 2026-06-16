// modules/identity/controllers/v1/addresses.controller.ts · owner-scoped address book.
import { Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../../core/auth/permissions.guard';
import { ZodBody } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { AddressService } from '../../services/address.service';
import { CreateAddressSchema, CreateAddressDto, UpdateAddressSchema, UpdateAddressDto } from '../../dto/create-address.dto';

@Controller({ path: 'addresses', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard)
export class AddressesController {
  constructor(private readonly addresses: AddressService) {}
  @Get() list(@CurrentContext() ctx: RequestContext) { return this.addresses.list(ctx.tenantId, ctx.userId).then((data) => ({ data })); }
  @Post() create(@CurrentContext() ctx: RequestContext, @ZodBody(CreateAddressSchema) dto: CreateAddressDto) { return this.addresses.create(ctx.tenantId, ctx.userId, dto).then((data) => ({ data })); }
  @Patch(':id') update(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @ZodBody(UpdateAddressSchema) dto: UpdateAddressDto) { return this.addresses.update(ctx.tenantId, ctx.userId, id, dto).then((data) => ({ data })); }
  @Delete(':id') remove(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.addresses.remove(ctx.tenantId, ctx.userId, id).then((data) => ({ data })); }
}
