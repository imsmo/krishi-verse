# education (PRD M09, §9.9) — the agri-learning library

Instructors author courses; learners enrol (free or paid) and learn. Gated by the `education` feature flag
(default **OFF**).

## What it owns

- **Instructors** — a per-user profile (`royalty_bps`, default 8000 = 80% per the Revenue Playbook). Platform
  instructors (tenant_id NULL, e.g. KVK) are admin-created only (Law 11).
- **Courses** — authored by an instructor. Lifecycle `draft → review → published ↔ paused → archived`
  (state machine, Law 5). `price_minor` is **bigint minor units** (Law 2; 0 = free). Browse is published-only;
  the platform library (tenant_id NULL) is visible to every tenant.
- **Lessons** — ordered by `(module_no, lesson_no)`; video/pdf/article/quiz/audio/live; idempotent upsert.
- **Enrollments** — one per `(course, learner)`. **Free** → instant. **Paid** → the learner buys a seat:
  a **zero-sum, idempotent `course_purchase`** wallet transfer — learner `userMain` → instructor `userMain`
  (royalty, floored) + platform `Fees` (remainder) — in the same tx as the enrollment (Law 2 + Law 4),
  idempotency key `coursebuy:<enrollmentId>`. A learner can't enrol twice nor in their own course.
- **Lesson progress** — per-lesson `seconds_watched`/`quiz_score`/completion; marking lessons recomputes the
  enrollment's `progress_pct` and stamps `completed_at` (+ `CourseCompleted`) exactly once at 100%.

## Surface (v1, all under the `education` flag)

`PUT/GET /v1/education/instructors/me` (`course.author`). Courses (`course.author` to write, `course.publish`
to publish/pause): `POST /v1/education/courses`, `GET` (box=`browse|mine|all`), `GET /:id`, `PATCH /:id`,
`POST /:id/{submit,publish,pause,archive}`, `POST/GET /:id/lessons`. Enrollments (any learner):
`POST /v1/education/enrollments` (Idempotency-Key), `GET`, `GET /:id`,
`POST /:id/lessons/:lessonId/progress`, `GET /:id/progress`.

## Threats considered (§4)

- **Tenant isolation / RLS** — `tenant_id` binds every tenant query; `instructors`/`courses`/`enrollments` are
  RLS-protected (courses/instructors also allow NULL = platform library). `course_lessons`/`lesson_progress`
  carry no `tenant_id` and are gated via the tenant-scoped course/enrollment JOIN.
- **No IDOR** — only a course's own instructor may edit it / add lessons (404, not 403, on a non-owner);
  enrolments + progress are learner-owned (404 for a non-owner); a learner can't probe another's enrolment.
- **No privilege escalation** — publishing is gated by `course.publish`; `royalty_bps` is not client-settable
  (no inflating your own cut); platform instructors/courses aren't writable via the tenant API.
- **Money correctness** — bigint minor units only; the split is zero-sum by construction (instructor floor +
  platform remainder = price); idempotent purchase (Law 3) so a retry never double-charges.
- **Abuse/DoS** — bounded list `LIMIT` + keyset pagination; enrol is idempotent per (user, endpoint).

## Deferred (schema present, not built)

Certificate (PDF) issuance on completion (`cert_enabled` + `certificate_media_id` are stored; rendering reuses
the media/PDF pipeline when wired); the online payment-intent enrol path (wallet purchase is the path here);
instructor payout aggregation jobs; quiz auto-grading.

## Tests

`__tests__/education-domain.spec.ts` (revenue split zero-sum, course state machine, progress recompute, royalty
bounds), `enrollment.service.spec.ts` (free vs paid wallet split, unpublished/own-course/double-enrol guards,
404 IDOR), `tenant-isolation.spec.ts` (CI gate), `education.integration.spec.ts` (real Postgres: author →
publish → paid enrol split ₹500→₹400+₹100 → complete → cross-tenant RLS denial; runs when `DATABASE_URL` is set).
