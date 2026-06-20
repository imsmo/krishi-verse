// modules/education/education.module.ts
// Education (PRD M09, §9.9) — the agri-learning library. Instructors author courses (draft→review→published↔
// paused→archived) with lessons (video/pdf/article/quiz/audio/live); learners enroll (free = instant; paid =
// a ZERO-SUM wallet purchase splitting price into instructor royalty (default 80%) + platform Fees, Law 2) and
// track lesson progress that recomputes the enrollment's progress_pct → completion. Gated by the `education`
// flag (default OFF).
//
// SCOPE (this build): instructor profiles + course authoring/lifecycle + lessons + enrollment (free + paid
// wallet split) + lesson progress + completion. DEFERRED: certificate (PDF) issuance on completion (cert_enabled
// + certificate_media_id are stored; rendering reuses the media/PDF pipeline when wired); the online payment-
// intent enrol path (wallet purchase is the path here); instructor payout aggregation jobs.
import { Module } from '@nestjs/common';
import { InstructorsController } from './controllers/v1/instructors.controller';
import { CoursesController } from './controllers/v1/courses.controller';
import { EnrollmentsController } from './controllers/v1/enrollments.controller';
import { InstructorService } from './services/instructor.service';
import { CourseService } from './services/course.service';
import { EnrollmentService } from './services/enrollment.service';
import { LessonProgressService } from './services/lesson-progress.service';
import { InstructorRepository } from './repositories/instructor.repository';
import { CourseRepository } from './repositories/course.repository';
import { CourseLessonRepository } from './repositories/course-lesson.repository';
import { EnrollmentRepository } from './repositories/enrollment.repository';
import { LessonProgressRepository } from './repositories/lesson-progress.repository';

@Module({
  controllers: [InstructorsController, CoursesController, EnrollmentsController],
  providers: [
    InstructorService, CourseService, EnrollmentService, LessonProgressService,
    InstructorRepository, CourseRepository, CourseLessonRepository, EnrollmentRepository, LessonProgressRepository,
  ],
  exports: [CourseService, EnrollmentService],
})
export class EducationModule {}
