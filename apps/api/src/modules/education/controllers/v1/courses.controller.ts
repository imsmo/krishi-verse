// modules/education/controllers/v1/courses.controller.ts · course authoring + lifecycle + lessons + browse.
// Authoring/lessons need course.author and the OWN course (service enforces, 404 on non-owner); publish/pause
// need course.publish. Browse/get are any authenticated user (published + platform library). `education` flag.
import { Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { CourseService } from '../../services/course.service';
import { EducationPermissions, canAuthor, canPublish, isEducationAdmin, canHost, canModerateContent } from '../../policies/education.policies';
import { CreateCourseSchema, CreateCourseDto, UpdateCourseSchema, UpdateCourseDto } from '../../dto/create-course.dto';
import { QueryCoursesSchema, QueryCoursesDto } from '../../dto/query-course.dto';
import { UpsertLessonSchema, UpsertLessonDto } from '../../dto/create-course-lesson.dto';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'education/courses', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('education')
export class CoursesController {
  constructor(private readonly svc: CourseService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canAuthor: canAuthor(ctx), canPublish: canPublish(ctx), isAdmin: isEducationAdmin(ctx), canHost: canHost(ctx), canModerate: canModerateContent(ctx) }; }

  @Post() @RequirePermissions(EducationPermissions.Author)
  create(@CurrentContext() ctx: RequestContext, @ZodBody(CreateCourseSchema) dto: CreateCourseDto) { return this.svc.create(ctx.tenantId, this.actor(ctx), dto).then((data) => ({ data })); }
  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryCoursesSchema) q: QueryCoursesDto) {
    return this.svc.list(ctx.tenantId, this.actor(ctx), { box: q.box, topicId: q.topicId, level: q.level, status: q.status, cursor: decodeCursor(q.cursor), limit: q.limit }).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Get(':id')
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.getById(ctx.tenantId, id).then((data) => ({ data })); }
  @Patch(':id') @RequirePermissions(EducationPermissions.Author)
  update(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @ZodBody(UpdateCourseSchema) dto: UpdateCourseDto) { return this.svc.update(ctx.tenantId, this.actor(ctx), id, dto).then((data) => ({ data })); }
  @Post(':id/submit') @RequirePermissions(EducationPermissions.Author)
  submit(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.setStatus(ctx.tenantId, this.actor(ctx), id, 'submit').then((data) => ({ data })); }
  @Post(':id/publish') @RequirePermissions(EducationPermissions.Publish)
  publish(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.setStatus(ctx.tenantId, this.actor(ctx), id, 'publish').then((data) => ({ data })); }
  @Post(':id/pause') @RequirePermissions(EducationPermissions.Publish)
  pause(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.setStatus(ctx.tenantId, this.actor(ctx), id, 'pause').then((data) => ({ data })); }
  @Post(':id/archive') @RequirePermissions(EducationPermissions.Author)
  archive(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.setStatus(ctx.tenantId, this.actor(ctx), id, 'archive').then((data) => ({ data })); }

  @Post(':id/lessons') @RequirePermissions(EducationPermissions.Author)
  upsertLesson(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @ZodBody(UpsertLessonSchema) dto: UpsertLessonDto) { return this.svc.upsertLesson(ctx.tenantId, this.actor(ctx), id, dto).then((data) => ({ data })); }
  @Get(':id/lessons')
  lessons(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.listLessons(ctx.tenantId, id).then((data) => ({ data })); }
}
