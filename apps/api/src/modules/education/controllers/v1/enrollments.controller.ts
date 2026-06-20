// modules/education/controllers/v1/enrollments.controller.ts · enroll + track progress (the caller's own).
// enroll requires an Idempotency-Key (a paid enroll moves money — Law 3). Reads + progress are learner-owned
// (404 on a non-owner — no IDOR). `education` flag.
import { Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { EnrollmentService } from '../../services/enrollment.service';
import { LessonProgressService } from '../../services/lesson-progress.service';
import { canAuthor, canPublish, isEducationAdmin } from '../../policies/education.policies';
import { QueryEnrollmentsSchema, QueryEnrollmentsDto } from '../../dto/query-enrollment.dto';
import { MarkProgressSchema, MarkProgressDto } from '../../dto/mark-lesson-progress.dto';
import { EnrollBodySchema, EnrollBodyDto } from '../../dto/enroll.dto';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'education/enrollments', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('education')
export class EnrollmentsController {
  constructor(private readonly enroll: EnrollmentService, private readonly progress: LessonProgressService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canAuthor: canAuthor(ctx), canPublish: canPublish(ctx), isAdmin: isEducationAdmin(ctx) }; }

  @Post()
  create(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(EnrollBodySchema) body: EnrollBodyDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.enroll.enroll(ctx.tenantId, this.actor(ctx), body.courseId, key).then((data) => ({ data }));
  }
  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryEnrollmentsSchema) q: QueryEnrollmentsDto) {
    return this.enroll.list(ctx.tenantId, this.actor(ctx), { completedOnly: q.completedOnly, cursor: decodeCursor(q.cursor), limit: q.limit }).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Get(':id')
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.enroll.getById(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }

  @Post(':id/lessons/:lessonId/progress')
  mark(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @Param('lessonId') lessonId: string, @ZodBody(MarkProgressSchema) dto: MarkProgressDto) {
    return this.progress.mark(ctx.tenantId, this.actor(ctx), id, lessonId, dto).then((data) => ({ data }));
  }
  @Get(':id/progress')
  listProgress(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.progress.listForEnrollment(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }
}

