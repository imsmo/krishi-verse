// modules/education/domain/course-lesson.entity.ts · a lesson within a course (ordered by module_no, lesson_no).
import { ContentKind } from './education.events';
import { InvalidCourseError } from './education.errors';

export interface CourseLessonProps {
  id: string; courseId: string; moduleNo: number; lessonNo: number; defaultTitle: string; contentKind: ContentKind;
  mediaId: string | null; body: string | null; durationSecs: number | null; quiz: unknown | null; createdAt?: Date;
}
export class CourseLesson {
  private constructor(private props: CourseLessonProps) {}
  static create(input: CourseLessonProps): CourseLesson {
    if (!input.defaultTitle) throw new InvalidCourseError('lesson title required');
    if (input.lessonNo < 1 || input.moduleNo < 1) throw new InvalidCourseError('module_no/lesson_no start at 1');
    return new CourseLesson(input);
  }
  static rehydrate(p: CourseLessonProps): CourseLesson { return new CourseLesson(p); }
  get id() { return this.props.id; }
  get courseId() { return this.props.courseId; }
  toProps(): Readonly<CourseLessonProps> { return Object.freeze({ ...this.props }); }
  toJSON() { const v = this.props; return { id: v.id, courseId: v.courseId, moduleNo: v.moduleNo, lessonNo: v.lessonNo, defaultTitle: v.defaultTitle, contentKind: v.contentKind, mediaId: v.mediaId, body: v.body, durationSecs: v.durationSecs, quiz: v.quiz, createdAt: v.createdAt }; }
}
