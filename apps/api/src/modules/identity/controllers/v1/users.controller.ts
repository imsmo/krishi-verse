// modules/identity/controllers/v1/users.controller.ts · self profile + admin user management.
import { Body, Controller, Get, Headers, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Inject } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { ZodBody } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../../core/idempotency/idempotency.service';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { UserService } from '../../services/user.service';
import { UpdateUserSchema, UpdateUserDto } from '../../dto/update-user.dto';
import { CreateUserSchema, CreateUserDto } from '../../dto/create-user.dto';
import { IdentityPermissions } from '../../policies/identity.policies';
import { z } from 'zod';

const ChangeStatusSchema = z.object({ status: z.enum(['active', 'suspended', 'restricted', 'soft_deleted']), reason: z.string().max(500).optional() }).strict();
const ipOf = (req: Request) => (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;

@Controller({ path: 'users', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard)
export class UsersController {
  constructor(
    private readonly users: UserService,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
  ) {}

  @Get('me')
  me(@CurrentContext() ctx: RequestContext) { return this.users.getById(ctx.tenantId, ctx.userId).then((data) => ({ data })); }

  @Patch('me')
  async updateMe(@CurrentContext() ctx: RequestContext, @ZodBody(UpdateUserSchema) dto: UpdateUserDto) {
    return { data: await this.users.updateProfile(ctx.tenantId, ctx.userId, dto) };
  }

  @Get(':id')
  @RequirePermissions(IdentityPermissions.Report)
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.users.getById(ctx.tenantId, id).then((data) => ({ data })); }

  @Post()
  @RequirePermissions(IdentityPermissions.Approve)
  async create(@CurrentContext() ctx: RequestContext, @Req() req: Request, @Headers('idempotency-key') key: string, @ZodBody(CreateUserSchema) dto: CreateUserDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    const data = await this.idem.remember(key, ctx.userId, 'identity.user.create', () => this.users.adminCreate(ctx.tenantId, ctx.userId, dto, ipOf(req)));
    return { data };
  }

  @Post(':id/status')
  @RequirePermissions(IdentityPermissions.Approve)
  async changeStatus(@CurrentContext() ctx: RequestContext, @Req() req: Request, @Param('id') id: string, @ZodBody(ChangeStatusSchema) dto: z.infer<typeof ChangeStatusSchema>) {
    return { data: await this.users.changeStatus(ctx.tenantId, ctx.userId, id, dto.status, dto.reason ?? null, ipOf(req)) };
  }
}
