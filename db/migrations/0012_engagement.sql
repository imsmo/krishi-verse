-- ============================================================================
-- MIGRATION 0012 — ENGAGEMENT
-- Source of truth: Database_Architecture/full_platform/11_engagement.sql (reproduced verbatim)
-- Runner: db/scripts/migrate.js wraps this file in ONE transaction and records it
-- in schema_migrations. NEVER edit an applied migration — add a new numbered one.
-- ============================================================================

-- ============================================================================
-- FILE 11 — EDUCATION (M09) · COMMUNICATION/CHAT (M13) · NOTIFICATION ENGINE ·
--           CMS (M14) · SUPPORT/HELPDESK (PRD §50)
-- ============================================================================

CREATE TYPE notif_status AS ENUM ('queued','sent','delivered','failed','read','suppressed');
CREATE TYPE ticket_status AS ENUM ('open','pending_customer','pending_internal','escalated','resolved','closed','reopened');

-- ================= EDUCATION (M09, PRD §9.9) =================
CREATE TABLE instructors (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id      uuid NOT NULL REFERENCES users(id),
  tenant_id    uuid REFERENCES tenants(id),           -- NULL = platform instructor (KVK etc.)
  bio          text,
  royalty_bps  integer NOT NULL DEFAULT 8000,         -- instructor keeps 80% (Revenue Playbook)
  is_verified  boolean NOT NULL DEFAULT false,
  UNIQUE (user_id, tenant_id)
);
CALL add_std_columns('instructors');

CREATE TABLE courses (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id     uuid REFERENCES tenants(id),          -- NULL = platform-wide library
  instructor_id uuid REFERENCES instructors(id),
  default_title varchar(250) NOT NULL,
  topic_id      uuid REFERENCES lookup_values(id),    -- 'course_topic': crop_care|soil|pest|organic|business|finlit|schemes|digital|safety
  audience_role_ids jsonb NOT NULL DEFAULT '[]',
  level         varchar(15) NOT NULL DEFAULT 'basic',
  price_minor   bigint NOT NULL DEFAULT 0,            -- 0 = free (80% of content free per playbook)
  currency_code char(3) NOT NULL DEFAULT 'INR',
  cert_enabled  boolean NOT NULL DEFAULT false,
  cover_media_id uuid REFERENCES media_assets(id),
  status        varchar(20) NOT NULL DEFAULT 'draft'  -- draft|review|published|archived
);
CALL add_std_columns('courses');
CREATE INDEX idx_courses_pub ON courses(tenant_id, status) WHERE status='published';

CREATE TABLE course_lessons (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  course_id    uuid NOT NULL REFERENCES courses(id),
  module_no    smallint NOT NULL DEFAULT 1,
  lesson_no    smallint NOT NULL,
  default_title varchar(250) NOT NULL,
  content_kind varchar(20) NOT NULL,                  -- video|pdf|article|quiz|live|audio
  media_id     uuid REFERENCES media_assets(id),
  body         text,
  duration_secs integer,
  quiz         jsonb,                                 -- questions+answers (lightweight)
  UNIQUE (course_id, module_no, lesson_no)
);
CALL add_std_columns('course_lessons');

CREATE TABLE enrollments (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  course_id    uuid NOT NULL REFERENCES courses(id),
  learner_user_id uuid NOT NULL REFERENCES users(id),
  payment_id   uuid REFERENCES payments(id),
  progress_pct numeric(5,2) NOT NULL DEFAULT 0,
  completed_at timestamptz,
  certificate_media_id uuid REFERENCES media_assets(id),
  UNIQUE (course_id, learner_user_id)
);
CALL add_std_columns('enrollments');
CREATE INDEX idx_enroll_learner ON enrollments(learner_user_id);

CREATE TABLE lesson_progress (
  enrollment_id uuid NOT NULL REFERENCES enrollments(id),
  lesson_id     uuid NOT NULL REFERENCES course_lessons(id),
  completed_at  timestamptz,
  seconds_watched integer NOT NULL DEFAULT 0,
  quiz_score    numeric(5,2),
  PRIMARY KEY (enrollment_id, lesson_id)
);

-- ================= COMMUNICATION (M13) =================
CREATE TABLE conversations (                          -- order chat, requirement chat, dispute chat, support
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  context_type varchar(40) NOT NULL,                  -- 'order','requirement','dispute','booking','direct','support_ticket'
  context_id   uuid,
  is_locked    boolean NOT NULL DEFAULT false
);
CALL add_std_columns('conversations');
CREATE INDEX idx_conversations_ctx ON conversations(context_type, context_id);

CREATE TABLE conversation_participants (
  conversation_id uuid NOT NULL REFERENCES conversations(id),
  user_id         uuid NOT NULL REFERENCES users(id),
  role            varchar(20) NOT NULL DEFAULT 'member',
  last_read_at    timestamptz,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages (
  id              uuid NOT NULL DEFAULT uuid_generate_v7(),
  conversation_id uuid NOT NULL,
  tenant_id       uuid NOT NULL,
  sender_user_id  uuid,                               -- NULL = system/AI
  body            text,
  voice_media_id  uuid,
  attachment_media_id uuid,
  is_ai_generated boolean NOT NULL DEFAULT false,     -- AI badge transparency
  is_flagged      boolean NOT NULL DEFAULT false,     -- abuse moderation
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_messages_conv ON messages(conversation_id, created_at DESC);

CREATE TABLE masked_calls (                           -- privacy-proxy call log (PRD §9.13)
  id           uuid NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id    uuid NOT NULL,
  caller_user_id uuid NOT NULL,
  callee_user_id uuid NOT NULL,
  context_type varchar(40),
  context_id   uuid,
  provider_call_ref varchar(120),
  duration_secs integer,
  recording_media_id uuid,                            -- consent-gated
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- ================= NOTIFICATION ENGINE (PRD §14 — fully dynamic) =================
CREATE TABLE notification_events (                    -- the trigger catalog (PRD §14.2 list as DATA)
  code          varchar(80) PRIMARY KEY,              -- 'order.delivered','bid.outbid','wage.paid','scheme.approved'
  default_name  varchar(150) NOT NULL,
  priority      varchar(15) NOT NULL DEFAULT 'informational' CHECK (priority IN ('critical','important','informational','promotional')),
  default_channels jsonb NOT NULL DEFAULT '["push"]',
  user_can_opt_out boolean NOT NULL DEFAULT true,     -- OTP/dispute = false
  batchable     boolean NOT NULL DEFAULT false        -- smart digest engine (PRD §14.4)
);
CALL add_std_columns('notification_events');

CREATE TABLE notification_templates (                 -- per event × channel × language (+ tenant overrides)
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  event_code    varchar(80) NOT NULL REFERENCES notification_events(code),
  channel       varchar(15) NOT NULL,                 -- push|sms|whatsapp|email|inapp|ivr
  language_code varchar(8) NOT NULL REFERENCES languages(code),
  tenant_id     uuid REFERENCES tenants(id),          -- NULL = platform default
  subject       varchar(250),
  body          text NOT NULL,                        -- {{variables}}
  provider_template_ref varchar(120),                 -- DLT template id / WA template name (approved)
  is_active     boolean NOT NULL DEFAULT true,
  UNIQUE (event_code, channel, language_code, tenant_id)
);
CALL add_std_columns('notification_templates');

CREATE TABLE notification_preferences (
  user_id    uuid NOT NULL REFERENCES users(id),
  event_code varchar(80) NOT NULL REFERENCES notification_events(code),
  channel    varchar(15) NOT NULL,
  is_enabled boolean NOT NULL,
  PRIMARY KEY (user_id, event_code, channel)
);

CREATE TABLE user_quiet_hours (
  user_id    uuid PRIMARY KEY REFERENCES users(id),
  starts     time NOT NULL DEFAULT '21:00',
  ends       time NOT NULL DEFAULT '06:00',
  timezone   varchar(40) NOT NULL DEFAULT 'Asia/Kolkata'
);

CREATE TABLE notifications (                          -- delivery log (partitioned; includes cost tracking)
  id           uuid NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id    uuid,
  user_id      uuid NOT NULL,
  event_code   varchar(80) NOT NULL,
  channel      varchar(15) NOT NULL,
  template_id  uuid,
  language_code varchar(8),
  payload      jsonb NOT NULL DEFAULT '{}',
  status       notif_status NOT NULL DEFAULT 'queued',
  provider_msg_ref varchar(150),
  cost_minor   integer,                               -- SMS cost-bomb monitor
  batched_into uuid,                                  -- digest grouping
  created_at   timestamptz NOT NULL DEFAULT now(),
  sent_at      timestamptz,
  read_at      timestamptz,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_notif_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notif_queue ON notifications(status, created_at) WHERE status='queued';

-- ================= CMS (M14) =================
CREATE TABLE cms_pages (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id    uuid REFERENCES tenants(id),           -- NULL = platform pages
  slug         varchar(150) NOT NULL,
  page_kind    varchar(30) NOT NULL DEFAULT 'static', -- static|policy|faq|help_article
  default_title varchar(250) NOT NULL,
  body         text NOT NULL,                         -- markdown; translations via translations table
  version      integer NOT NULL DEFAULT 1,
  status       varchar(15) NOT NULL DEFAULT 'draft',  -- draft|published|archived
  published_at timestamptz,
  UNIQUE (tenant_id, slug, version)
);
CALL add_std_columns('cms_pages');

CREATE TABLE banners (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  placement    varchar(40) NOT NULL,                  -- 'home_hero','category_top','wallet'
  media_id     uuid NOT NULL REFERENCES media_assets(id),
  language_code varchar(8) REFERENCES languages(code),
  target_url   varchar(400),
  audience_rules jsonb NOT NULL DEFAULT '{}',         -- {roles:[], regions:[], min_orders:0}
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz NOT NULL,
  click_count  integer NOT NULL DEFAULT 0,
  is_active    boolean NOT NULL DEFAULT true
);
CALL add_std_columns('banners');
CREATE INDEX idx_banners_active ON banners(tenant_id, placement) WHERE is_active;

-- ================= SUPPORT / HELPDESK (PRD §50) =================
CREATE TABLE support_tickets (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id    uuid REFERENCES tenants(id),
  ticket_no    varchar(40) NOT NULL UNIQUE,
  requester_user_id uuid REFERENCES users(id),
  channel      varchar(20) NOT NULL,                  -- app|whatsapp|ivr|phone|email|ambassador
  category_id  uuid REFERENCES lookup_values(id),     -- 'ticket_category': payment|kyc|order|dispute|technical|safety|emergency_vet|women_safety
  severity     varchar(5) NOT NULL DEFAULT 'P2' CHECK (severity IN ('P0','P1','P2','P3')),
  subject      varchar(250),
  status       ticket_status NOT NULL DEFAULT 'open',
  assignee_user_id uuid REFERENCES users(id),
  conversation_id uuid REFERENCES conversations(id),
  sla_first_response_due timestamptz,
  sla_resolution_due timestamptz,
  first_responded_at timestamptz,
  resolved_at  timestamptz,
  csat_score   smallint CHECK (csat_score BETWEEN 1 AND 5)
);
CALL add_std_columns('support_tickets');
CREATE INDEX idx_tickets_open ON support_tickets(tenant_id, status, severity) WHERE status NOT IN ('resolved','closed');
CREATE INDEX idx_tickets_assignee ON support_tickets(assignee_user_id) WHERE status NOT IN ('resolved','closed');

