// modules/education/controllers/v1/instructors.controller.ts · become/manage the caller's instructor profile.
// Requires course.author. royalty_bps is not client-settable here. `education` flag.
import { Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { InstructorService } from '../../services/instructor.service';
import { EducationPermissions, canAuthor, canPublish, isEducationAdmin, canHost, canModerateContent } from '../../policies/education.policies';
import { CreateInstructorSchema, CreateInstructorDto } from '../../dto/create-instructor.dto';

@Controller({ path: 'education/instructors', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('education')
export class InstructorsController {
  constructor(private readonly svc: InstructorService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canAuthor: canAuthor(ctx), canPublish: canPublish(ctx), isAdmin: isEducationAdmin(ctx), canHost: canHost(ctx), canModerate: canModerateContent(ctx) }; }

  @Put('me') @RequirePermissions(EducationPermissions.Author)
  become(@CurrentContext() ctx: RequestContext, @ZodBody(CreateInstructorSchema) dto: CreateInstructorDto) { return this.svc.become(ctx.tenantId, this.actor(ctx), dto.bio ?? null).then((data) => ({ data })); }
  @Get('me')
  mine(@CurrentContext() ctx: RequestContext) { return this.svc.getMine(ctx.tenantId, this.actor(ctx)).then((data) => ({ data })); }
}
