-- FAW-AI Migration 002: Enhanced Roles, Auth Triggers, Admin RLS, and Student Analytics
-- Apply this file in the Supabase SQL Editor.

-- 1. Ensure pgcrypto extension
create extension if not exists pgcrypto;

-- 2. Update role constraint on public.profiles to support 'faculty', 'professor', and 'admin'
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('faculty', 'professor', 'admin', 'FACULTY', 'ADMIN'));

alter table public.profiles alter column role set default 'faculty';

-- 3. Security definer functions for role verification
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

-- 4. Automatic profile generation on user sign-up
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

-- 5. Enhanced Profiles RLS policies
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

-- 6. Admin Institutional Access to existing tables
drop policy if exists "courses_admin_all" on public.courses;
create policy "courses_admin_all" on public.courses for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "documents_admin_select" on public.academic_documents;
create policy "documents_admin_select" on public.academic_documents for select using (public.is_admin());

drop policy if exists "generated_docs_admin_select" on public.generated_documents;
create policy "generated_docs_admin_select" on public.generated_documents for select using (public.is_admin());

drop policy if exists "tasks_admin_select" on public.agent_tasks;
create policy "tasks_admin_select" on public.agent_tasks for select using (public.is_admin());

drop policy if exists "usage_admin_select" on public.ai_usage_logs;
create policy "usage_admin_select" on public.ai_usage_logs for select using (public.is_admin());

drop policy if exists "usage_insert_auth" on public.ai_usage_logs;
create policy "usage_insert_auth" on public.ai_usage_logs for insert with check (auth.uid() = owner_id or owner_id is null);

drop policy if exists "activity_admin_select" on public.activity_logs;
create policy "activity_admin_select" on public.activity_logs for select using (public.is_admin());

drop policy if exists "activity_insert_auth" on public.activity_logs;
create policy "activity_insert_auth" on public.activity_logs for insert with check (auth.uid() = actor_id or actor_id is null);

-- 7. Student Analytics Tables (Module 5.E)
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
  assessment_type text not null default 'exam' check (assessment_type in ('quiz', 'assignment', 'midterm', 'final', 'project', 'other')),
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

create index if not exists students_course_idx on public.students(course_id);
create index if not exists students_owner_idx on public.students(owner_id);
create index if not exists assessments_course_idx on public.student_assessments(course_id);
create index if not exists scores_assessment_idx on public.student_scores(assessment_id);

alter table public.students enable row level security;
alter table public.student_assessments enable row level security;
alter table public.student_scores enable row level security;

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

-- 8. Storage bucket policies for academic-documents
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
