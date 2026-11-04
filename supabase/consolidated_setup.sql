-- =====================================================================
-- FAW-AI (Faculty AI Workload Assistant)
-- Consolidated Database Setup & Migration Script
-- Target Supabase Project: rltvgdcwmgwikoukdjxq
-- =====================================================================

-- 1. Extensions
create extension if not exists pgcrypto;

-- 2. Core Profiles Table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'faculty' check (role in ('faculty', 'professor', 'admin', 'FACULTY', 'ADMIN')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 3. Courses Table
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  course_code text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Academic Documents Table
create table if not exists public.academic_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  filename text not null,
  mime_type text,
  file_size bigint,
  storage_provider text not null default 'supabase-primary',
  bucket_name text not null default 'academic-documents',
  object_path text not null,
  processing_status text not null default 'uploaded'
    check (processing_status in ('uploaded','processing','processed','failed')),
  created_at timestamptz not null default now()
);

-- 5. AI Conversations & Messages
create table if not exists public.agent_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now()
);

create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.agent_conversations(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);

-- 6. AI Agent Tasks & Generated Curriculum Documents
create table if not exists public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  task_type text not null,
  status text not null default 'queued'
    check (status in ('queued','processing','validating','completed','failed','cancelled')),
  input jsonb not null default '{}'::jsonb,
  result jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generated_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  task_id uuid references public.agent_tasks(id) on delete set null,
  title text not null,
  document_type text not null,
  content jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  status text not null default 'approved' check (status in ('draft','reviewed','approved')),
  created_at timestamptz not null default now()
);

-- 7. Telemetry & Governance Logs
create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  provider text not null default 'gemini',
  model text,
  status text not null,
  input_tokens integer,
  output_tokens integer,
  error_code text,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  resource_type text,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 8. Storage Providers Registry
create table if not exists public.storage_providers (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  provider_type text not null default 'supabase',
  project_ref text not null,
  bucket_name text not null,
  enabled boolean not null default true,
  priority integer not null default 100,
  created_at timestamptz not null default now(),
  unique(project_ref, bucket_name)
);

create table if not exists public.storage_objects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  document_id uuid references public.academic_documents(id) on delete set null,
  provider_id uuid references public.storage_providers(id) on delete restrict,
  project_ref text not null,
  bucket_name text not null,
  object_path text not null,
  original_filename text not null,
  mime_type text,
  file_size bigint,
  checksum text,
  upload_status text not null default 'pending'
    check (upload_status in ('pending','uploaded','verified','failed')),
  created_at timestamptz not null default now(),
  unique(project_ref, bucket_name, object_path)
);

-- 9. Student Analytics & Gradebook Tables
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  student_id_number text not null,
  full_name text not null,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.student_assessments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  assessment_type text not null default 'quiz' check (assessment_type in ('quiz', 'assignment', 'midterm', 'final', 'project', 'other')),
  max_score numeric not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.student_scores (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.student_assessments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  score numeric not null,
  feedback text,
  created_at timestamptz not null default now(),
  unique(assessment_id, student_id)
);

-- 10. Performance Indexes
create index if not exists storage_objects_owner_idx on public.storage_objects(owner_id);
create index if not exists courses_owner_id_idx on public.courses(owner_id);
create index if not exists documents_owner_id_idx on public.academic_documents(owner_id);
create index if not exists tasks_owner_status_idx on public.agent_tasks(owner_id, status);
create index if not exists conversations_owner_idx on public.agent_conversations(owner_id);
create index if not exists messages_conversation_idx on public.agent_messages(conversation_id, created_at);
create index if not exists students_course_idx on public.students(course_id);
create index if not exists students_owner_idx on public.students(owner_id);
create index if not exists assessments_course_idx on public.student_assessments(course_id);
create index if not exists scores_assessment_idx on public.student_scores(assessment_id);

-- 11. Security Definer Helper Functions for RLS
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'ADMIN') and is_active = true
  );
$$;

create or replace function public.is_faculty()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('faculty', 'professor', 'FACULTY') and is_active = true
  );
$$;

-- 12. Automated User Profile Provisioning Trigger
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  user_role text;
  user_full_name text;
begin
  user_role := lower(coalesce(new.raw_user_meta_data->>'role', 'faculty'));
  if user_role not in ('faculty', 'professor', 'admin') then
    user_role := 'faculty';
  end if;

  user_full_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, full_name, role, is_active, created_at)
  values (new.id, user_full_name, user_role, true, now())
  on conflict (id) do update
  set full_name = coalesce(excluded.full_name, profiles.full_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 13. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.academic_documents enable row level security;
alter table public.agent_conversations enable row level security;
alter table public.agent_messages enable row level security;
alter table public.agent_tasks enable row level security;
alter table public.generated_documents enable row level security;
alter table public.ai_usage_logs enable row level security;
alter table public.activity_logs enable row level security;
alter table public.storage_objects enable row level security;
alter table public.students enable row level security;
alter table public.student_assessments enable row level security;
alter table public.student_scores enable row level security;

-- 14. Policies for Faculty & Isolation
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);

drop policy if exists "profiles_admin_select" on public.profiles;
create policy "profiles_admin_select" on public.profiles for select using (public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles for update using (public.is_admin());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

-- Courses Policies
drop policy if exists "courses_owner_all" on public.courses;
create policy "courses_owner_all" on public.courses for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "courses_admin_all" on public.courses;
create policy "courses_admin_all" on public.courses for all using (public.is_admin()) with check (public.is_admin());

-- Documents Policies
drop policy if exists "documents_owner_all" on public.academic_documents;
create policy "documents_owner_all" on public.academic_documents for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "documents_admin_select" on public.academic_documents;
create policy "documents_admin_select" on public.academic_documents for select using (public.is_admin());

-- Conversations & Messages
drop policy if exists "conversations_owner_all" on public.agent_conversations;
create policy "conversations_owner_all" on public.agent_conversations for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "messages_owner_all" on public.agent_messages;
create policy "messages_owner_all" on public.agent_messages for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Tasks & Generated Docs
drop policy if exists "tasks_owner_all" on public.agent_tasks;
create policy "tasks_owner_all" on public.agent_tasks for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "tasks_admin_select" on public.agent_tasks;
create policy "tasks_admin_select" on public.agent_tasks for select using (public.is_admin());

drop policy if exists "generated_docs_owner_all" on public.generated_documents;
create policy "generated_docs_owner_all" on public.generated_documents for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "generated_docs_admin_select" on public.generated_documents;
create policy "generated_docs_admin_select" on public.generated_documents for select using (public.is_admin());

-- Usage & Activity
drop policy if exists "usage_owner_select" on public.ai_usage_logs;
create policy "usage_owner_select" on public.ai_usage_logs for select using (auth.uid() = owner_id);

drop policy if exists "usage_admin_select" on public.ai_usage_logs;
create policy "usage_admin_select" on public.ai_usage_logs for select using (public.is_admin());

drop policy if exists "usage_insert_auth" on public.ai_usage_logs;
create policy "usage_insert_auth" on public.ai_usage_logs for insert with check (auth.uid() = owner_id or owner_id is null);

drop policy if exists "activity_owner_select" on public.activity_logs;
create policy "activity_owner_select" on public.activity_logs for select using (auth.uid() = actor_id);

drop policy if exists "activity_admin_select" on public.activity_logs;
create policy "activity_admin_select" on public.activity_logs for select using (public.is_admin());

drop policy if exists "activity_insert_auth" on public.activity_logs;
create policy "activity_insert_auth" on public.activity_logs for insert with check (auth.uid() = actor_id or actor_id is null);

-- Storage Objects Policies
drop policy if exists "storage_objects_owner_select" on public.storage_objects;
create policy "storage_objects_owner_select" on public.storage_objects for select using (auth.uid() = owner_id);

-- Student Analytics Policies
drop policy if exists "students_owner_all" on public.students;
create policy "students_owner_all" on public.students for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "students_admin_select" on public.students;
create policy "students_admin_select" on public.students for select using (public.is_admin());

drop policy if exists "assessments_owner_all" on public.student_assessments;
create policy "assessments_owner_all" on public.student_assessments for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "assessments_admin_select" on public.student_assessments;
create policy "assessments_admin_select" on public.student_assessments for select using (public.is_admin());

drop policy if exists "scores_owner_all" on public.student_scores;
create policy "scores_owner_all" on public.student_scores for all
  using (exists (select 1 from public.student_assessments a where a.id = assessment_id and a.owner_id = auth.uid()))
  with check (exists (select 1 from public.student_assessments a where a.id = assessment_id and a.owner_id = auth.uid()));

drop policy if exists "scores_admin_select" on public.student_scores;
create policy "scores_admin_select" on public.student_scores for select using (public.is_admin());

-- 15. Storage Bucket & Policies for Academic Documents
insert into storage.buckets (id, name, public)
values ('academic-documents', 'academic-documents', false)
on conflict (id) do nothing;

drop policy if exists "academic_docs_insert_own" on storage.objects;
create policy "academic_docs_insert_own" on storage.objects for insert to authenticated
with check (bucket_id = 'academic-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "academic_docs_select_own" on storage.objects;
create policy "academic_docs_select_own" on storage.objects for select to authenticated
using (bucket_id = 'academic-documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

drop policy if exists "academic_docs_delete_own" on storage.objects;
create policy "academic_docs_delete_own" on storage.objects for delete to authenticated
using (bucket_id = 'academic-documents' and (storage.foldername(name))[1] = auth.uid()::text);
