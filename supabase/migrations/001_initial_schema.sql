-- FAW-AI initial schema. Review and apply through the Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'professor' check (role in ('professor','admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  course_code text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  status text not null default 'draft' check (status in ('draft','reviewed','approved')),
  created_at timestamptz not null default now()
);

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


-- Storage registry: one primary database can track objects in multiple authorised
-- storage projects. Credentials are intentionally NOT stored in these tables.
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

create index if not exists storage_objects_owner_idx on public.storage_objects(owner_id);
alter table public.storage_objects enable row level security;
create policy "storage_objects_owner_select" on public.storage_objects for select using (auth.uid() = owner_id);

create index if not exists courses_owner_id_idx on public.courses(owner_id);
create index if not exists documents_owner_id_idx on public.academic_documents(owner_id);
create index if not exists tasks_owner_status_idx on public.agent_tasks(owner_id, status);
create index if not exists conversations_owner_idx on public.agent_conversations(owner_id);
create index if not exists messages_conversation_idx on public.agent_messages(conversation_id, created_at);

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.academic_documents enable row level security;
alter table public.agent_conversations enable row level security;
alter table public.agent_messages enable row level security;
alter table public.agent_tasks enable row level security;
alter table public.generated_documents enable row level security;
alter table public.ai_usage_logs enable row level security;
alter table public.activity_logs enable row level security;

-- Users may read their own profile. Do not allow client-side role changes.
-- Profile creation and role changes must be performed by trusted server-side workflows.
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);

create policy "courses_owner_all" on public.courses for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "documents_owner_all" on public.academic_documents for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "conversations_owner_all" on public.agent_conversations for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "messages_owner_all" on public.agent_messages for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "tasks_owner_all" on public.agent_tasks for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "generated_docs_owner_all" on public.generated_documents for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "usage_owner_select" on public.ai_usage_logs for select using (auth.uid() = owner_id);
create policy "activity_owner_select" on public.activity_logs for select using (auth.uid() = actor_id);

-- Create a private bucket manually or through a reviewed migration:
-- academic-documents (private; do not make this bucket public).
