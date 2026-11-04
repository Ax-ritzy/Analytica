-- ==============================================================================
-- FAW-AI Final Setup: Storage Bucket Creation + Performance Indexes
-- Run this in your Supabase SQL Editor (takes ~3 seconds)
-- ==============================================================================

-- 1. Create the Private Storage Bucket for Syllabi and Academic Documents
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'academic-documents',
  'academic-documents',
  false,
  10485760, -- 10MB limit
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
)
on conflict (id) do nothing;

-- 2. Storage Object Security Policies (Row Level Security on Storage)
drop policy if exists "academic_docs_insert_own" on storage.objects;
create policy "academic_docs_insert_own" on storage.objects for insert to authenticated
with check (bucket_id = 'academic-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "academic_docs_select_own" on storage.objects;
create policy "academic_docs_select_own" on storage.objects for select to authenticated
using (bucket_id = 'academic-documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

drop policy if exists "academic_docs_delete_own" on storage.objects;
create policy "academic_docs_delete_own" on storage.objects for delete to authenticated
using (bucket_id = 'academic-documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- 3. Performance & Query Latency Optimization Indexes
create index if not exists idx_academic_documents_course_id
  on public.academic_documents(course_id);

create index if not exists idx_academic_documents_owner_course
  on public.academic_documents(owner_id, course_id);

create index if not exists idx_academic_documents_created_at_desc
  on public.academic_documents(created_at desc);

create index if not exists idx_activity_logs_created_at_desc
  on public.activity_logs(created_at desc);

create index if not exists idx_activity_logs_actor_id
  on public.activity_logs(actor_id);

create index if not exists idx_generated_docs_owner_type_created
  on public.generated_documents(owner_id, document_type, created_at desc);

create index if not exists idx_student_scores_student_id
  on public.student_scores(student_id);

create index if not exists idx_student_assessments_owner_id
  on public.student_assessments(owner_id);

create index if not exists idx_student_assessments_course_owner
  on public.student_assessments(course_id, owner_id);

create index if not exists idx_agent_messages_conversation_created
  on public.agent_messages(conversation_id, created_at asc);
