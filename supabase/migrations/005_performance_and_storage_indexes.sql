-- ==============================================================================
-- FAW-AI Migration 005: Database Indexing, Query & Storage Latency Optimization
-- ==============================================================================
-- Purpose:
--   1. Accelerate Course Document lookups in /courses and /api/assistant RAG queries.
--   2. Accelerate Notification Center and Audit Log queries across all routes.
--   3. Turn sequential full-table scans into B-Tree index scans for saved documents.
--   4. Accelerate student analytics, gradebook lookups, and RLS evaluation.
--   5. Optimize agent message chronological loading.
-- ==============================================================================

-- 1. Academic Documents (Course RAG & Syllabus lookups)
create index if not exists idx_academic_documents_course_id
  on public.academic_documents(course_id);

create index if not exists idx_academic_documents_owner_course
  on public.academic_documents(owner_id, course_id);

create index if not exists idx_academic_documents_created_at_desc
  on public.academic_documents(created_at desc);

-- 2. Activity & Audit Logs (NotificationCenter & Admin Portal)
create index if not exists idx_activity_logs_created_at_desc
  on public.activity_logs(created_at desc);

create index if not exists idx_activity_logs_actor_id
  on public.activity_logs(actor_id);

-- 3. Generated Documents (Saved Lesson Plans & Question Studio)
create index if not exists idx_generated_docs_owner_type_created
  on public.generated_documents(owner_id, document_type, created_at desc);

-- 4. Student Analytics & Gradebook Queries
create index if not exists idx_student_scores_student_id
  on public.student_scores(student_id);

create index if not exists idx_student_assessments_owner_id
  on public.student_assessments(owner_id);

create index if not exists idx_student_assessments_course_owner
  on public.student_assessments(course_id, owner_id);

-- 5. Agent Chat Messages
create index if not exists idx_agent_messages_conversation_created
  on public.agent_messages(conversation_id, created_at asc);
