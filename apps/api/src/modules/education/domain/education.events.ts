// modules/education/domain/education.events.ts · integration events (via outbox) + vocab.
export const EducationEventType = {
  CoursePublished:  'education.course_published',
  CourseArchived:   'education.course_archived',
  Enrolled:         'education.enrolled',
  CoursePurchased:  'education.course_purchased',
  LessonCompleted:  'education.lesson_completed',
  CourseCompleted:  'education.course_completed',
} as const;
export type EducationEventType = (typeof EducationEventType)[keyof typeof EducationEventType];
export type DomainEvent = { type: string; payload: Record<string, unknown> };

export const COURSE_STATUSES = ['draft', 'review', 'published', 'paused', 'archived'] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];
export const COURSE_LEVELS = ['basic', 'intermediate', 'advanced'] as const;
export type CourseLevel = (typeof COURSE_LEVELS)[number];
export const CONTENT_KINDS = ['video', 'pdf', 'article', 'quiz', 'live', 'audio'] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];
