-- apps/api/test/sql/reference-slices/education_slice.sql · REFERENCE ONLY (not wired into tests).
-- A self-contained sketch of the education spine (db/migrations/0012) — instructors + courses + course_lessons
-- + enrollments + lesson_progress — plus tenant RLS. The real integration test builds its DB from the REAL
-- db/migrations + db/seeds (incl. the seeded course_purchase ledger type + course_topic lookups).
--
-- Flow: an instructor authors a course (draft→review→published) with lessons → a learner enrolls (free instant;
-- paid = a zero-sum wallet split learner→instructor royalty + platform) → marks lessons complete → progress_pct
-- recomputes → completion. instructors/courses may be platform-global (tenant_id NULL); enrollments are tenant-scoped.
BEGIN;
DROP TABLE IF EXISTS lesson_progress, enrollments, course_lessons, courses, instructors, lookup_values, users, tenants CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id() CASCADE; DROP FUNCTION IF EXISTS uuid_generate_v7() CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql VOLATILE;
CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$ LANGUAGE sql STABLE;

CREATE TABLE tenants (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users   (id uuid PRIMARY KEY, phone varchar(20) UNIQUE NOT NULL);
CREATE TABLE lookup_values (id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), type_code varchar(60), tenant_id uuid, code varchar(60));

CREATE TABLE instructors (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), user_id uuid NOT NULL REFERENCES users(id), tenant_id uuid REFERENCES tenants(id),
  bio text, royalty_bps integer NOT NULL DEFAULT 8000, is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid, UNIQUE (user_id, tenant_id));

CREATE TABLE courses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid REFERENCES tenants(id), instructor_id uuid REFERENCES instructors(id),
  default_title varchar(250) NOT NULL, topic_id uuid REFERENCES lookup_values(id), audience_role_ids jsonb NOT NULL DEFAULT '[]', level varchar(15) NOT NULL DEFAULT 'basic',
  price_minor bigint NOT NULL DEFAULT 0, currency_code char(3) NOT NULL DEFAULT 'INR', cert_enabled boolean NOT NULL DEFAULT false, cover_media_id uuid, status varchar(20) NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid);
CREATE INDEX idx_courses_pub ON courses(tenant_id, status) WHERE status='published';

CREATE TABLE course_lessons (  -- gated via the course (no tenant_id of its own)
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), course_id uuid NOT NULL REFERENCES courses(id), module_no smallint NOT NULL DEFAULT 1, lesson_no smallint NOT NULL,
  default_title varchar(250) NOT NULL, content_kind varchar(20) NOT NULL, media_id uuid, body text, duration_secs integer, quiz jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid, UNIQUE (course_id, module_no, lesson_no));

CREATE TABLE enrollments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), tenant_id uuid NOT NULL REFERENCES tenants(id), course_id uuid NOT NULL REFERENCES courses(id), learner_user_id uuid NOT NULL REFERENCES users(id),
  payment_id uuid, progress_pct numeric(5,2) NOT NULL DEFAULT 0, completed_at timestamptz, certificate_media_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid, UNIQUE (course_id, learner_user_id));

CREATE TABLE lesson_progress (  -- gated via the enrollment (no tenant_id of its own)
  enrollment_id uuid NOT NULL REFERENCES enrollments(id), lesson_id uuid NOT NULL REFERENCES course_lessons(id),
  completed_at timestamptz, seconds_watched integer NOT NULL DEFAULT 0, quiz_score numeric(5,2), PRIMARY KEY (enrollment_id, lesson_id));

-- RLS: tenant-scoped tables private to their tenant; courses/instructors allow NULL (platform library, visible to all).
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY; ALTER TABLE instructors FORCE ROW LEVEL SECURITY;
ALTER TABLE courses     ENABLE ROW LEVEL SECURITY; ALTER TABLE courses     FORCE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY; ALTER TABLE enrollments FORCE ROW LEVEL SECURITY;
CREATE POLICY t_iso_instr  ON instructors USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
CREATE POLICY t_iso_course ON courses     USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
CREATE POLICY t_iso_enroll ON enrollments USING (tenant_id = current_tenant_id());
COMMIT;
