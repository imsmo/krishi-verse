// modules/identity/controllers/v1/auth.controller.ts · phone-OTP login, refresh, logout, sessions.
// Login endpoints are @Public (anonymous can authenticate); tenant is taken from the body
// for login/refresh and from the token context for session management.
import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../../core/auth/permissions.guard';
import { Public } from '../../../../core/auth/public.decorator';
import { ZodBody } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { AuthService } from '../../services/auth.service';
import { SessionService } from '../../services/session.service';
import { RequestOtpSchema, RequestOtpDto, VerifyOtpSchema, VerifyOtpDto, RefreshSchema, RefreshDto, LogoutSchema, LogoutDto } from '../../dto/auth.dto';

const ipOf = (req: Request) => (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly sessions: SessionService) {}

  @Public() @Post('otp')
  requestOtp(@ZodBody(RequestOtpSchema) dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.phone, dto.channel).then((data) => ({ data }));
  }

  @Public() @Post('verify')
  async verify(@Req() req: Request, @ZodBody(VerifyOtpSchema) dto: VerifyOtpDto) {
    return { data: await this.auth.verifyOtp(dto, ipOf(req)) };
  }

  @Public() @Post('refresh')
  async refresh(@Req() req: Request, @ZodBody(RefreshSchema) dto: RefreshDto) {
    return { data: await this.auth.refreshSession(dto, ipOf(req)) };
  }

  @UseGuards(AuthGuard, PermissionsGuard) @Post('logout')
  async logout(@CurrentContext() ctx: RequestContext, @ZodBody(LogoutSchema) dto: LogoutDto) {
    return { data: await this.auth.logout(ctx.tenantId, ctx.userId, ctx.sessionId, dto.allDevices) };
  }

  @UseGuards(AuthGuard, PermissionsGuard) @Get('sessions')
  async list(@CurrentContext() ctx: RequestContext) {
    return { data: await this.sessions.list(ctx.tenantId, ctx.userId) };
  }

  @UseGuards(AuthGuard, PermissionsGuard) @Delete('sessions/:id')
  async revoke(@CurrentContext() ctx: RequestContext, @Param('id') id: string) {
    return { data: await this.sessions.revoke(ctx.tenantId, ctx.userId, id) };
  }
}
