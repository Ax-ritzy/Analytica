-- ==============================================================================
-- FAW-AI: Safe First Institutional Administrator Bootstrap Procedure (Final Review)
-- ==============================================================================
-- Designated Initial Administrator:
--   Name: Ritvik
--   Email: ritviksankar.k2005@gmail.com
--   Role: admin
--
-- Safety & Security Rules:
--   1. NEVER include or hardcode passwords in this or any SQL script.
--   2. The user must register their account securely via the FAW-AI UI (/login or /register)
--      using Supabase Auth and CONFIRM their email before running Step 2.
--   3. This script will NOT elevate an unverified email (email_confirmed_at must not be null).
--   4. Wrapped in an atomic transaction block with rollbacks on failure.
--   5. Idempotent: safe to run multiple times without unintended state modifications.
--   6. Records an immutable audit log entry in public.activity_logs.
--   7. Preserves all other faculty profiles and academic data.
-- ==============================================================================

-- ==============================================================================
-- STEP 1: PRE-ELEVATION AUDIT & INSPECTION (READ-ONLY)
-- Run this block first in the Supabase SQL Editor to verify that the designated
-- account exists and has confirmed their email.
-- ==============================================================================

select
  u.id as auth_user_id,
  u.email,
  u.email_confirmed_at,
  case
    when u.email_confirmed_at is not null then 'CONFIRMED'
    else 'UNCONFIRMED - ELEVATION BLOCKED'
  end as email_status,
  p.full_name,
  p.role as current_role,
  p.is_active as current_active_status,
  p.created_at as registered_at
from auth.users u
left join public.profiles p on u.id = p.id
where lower(u.email) = lower('ritviksankar.k2005@gmail.com');

-- Inspection Evaluation:
--   - If 1 row is returned with email_status = 'CONFIRMED' and current_role = 'faculty': Proceed to Step 2.
--   - If 1 row is returned with email_status = 'UNCONFIRMED': The user must click the confirmation link in their email first.
--   - If 1 row is returned with current_role = 'admin': Account is already an active administrator. No action needed.
--   - If 0 rows are returned: The user has not registered yet.
--     ACTION REQUIRED: Ritvik must register first via the FAW-AI web application (/login).
--     DO NOT attempt to insert arbitrary records directly into auth.users.

-- ==============================================================================
-- STEP 2: CONTROLLED ELEVATION TRANSACTION (MANUAL EXECUTION ONLY)
-- Run this block only after Step 1 confirms the account exists in auth.users and
-- has a valid email_confirmed_at timestamp.
-- ==============================================================================

do $$
declare
  target_email constant text := lower('ritviksankar.k2005@gmail.com');
  target_user_id uuid;
  user_match_count int;
  is_email_confirmed boolean;
  existing_role text;
  is_already_active boolean;
begin
  -- 1. Identify target account and verify uniqueness
  select count(*) into user_match_count
  from auth.users u
  where lower(u.email) = target_email;

  if user_match_count = 0 then
    raise exception 'Bootstrap Aborted: No account found with email "%". User must register first via the application.', target_email;
  elsif user_match_count > 1 then
    raise exception 'Bootstrap Aborted: Ambiguous state. Multiple accounts found with email "%".', target_email;
  end if;

  -- 2. Strictly verify email confirmation status
  select u.id, (u.email_confirmed_at is not null)
  into target_user_id, is_email_confirmed
  from auth.users u
  where lower(u.email) = target_email;

  if not is_email_confirmed then
    raise exception 'Bootstrap Aborted: Account "%" exists but email is not confirmed (email_confirmed_at is null). The user must confirm their email before administrative elevation.', target_email;
  end if;

  -- 3. Inspect profile status and acquire row lock to guarantee transaction isolation
  select p.role, p.is_active into existing_role, is_already_active
  from public.profiles p
  where p.id = target_user_id
  for update;

  if not found then
    -- Safe missing-profile recovery compatible with schema
    insert into public.profiles (id, full_name, role, is_active, created_at)
    values (target_user_id, 'Ritvik', 'admin', true, now());

    existing_role := 'faculty';
    raise notice 'Note: Created missing profile entry for "%" with administrator role.', target_email;
  elsif existing_role = 'admin' and is_already_active = true then
    raise notice 'Account "%" is already an active institutional administrator. No changes needed.', target_email;
    return;
  else
    -- 4. Perform controlled elevation
    update public.profiles
    set
      role = 'admin',
      is_active = true
    where id = target_user_id;
  end if;

  -- 5. Record bootstrap event in immutable activity audit log (atomic with elevation)
  insert into public.activity_logs (actor_id, action, resource_type, resource_id, metadata)
  values (
    target_user_id,
    'first_admin_bootstrap',
    'profiles',
    target_user_id,
    jsonb_build_object(
      'target_email', target_email,
      'previous_role', coalesce(existing_role, 'unknown'),
      'elevated_role', 'admin',
      'email_confirmed', true,
      'authorized_at', now(),
      'mechanism', 'supabase_sql_editor_bootstrap'
    )
  );

  raise notice 'SUCCESS: Account "%" (ID: %) successfully elevated to institutional administrator.', target_email, target_user_id;
end;
$$;

-- ==============================================================================
-- STEP 3: POST-ELEVATION VERIFICATION
-- Run this query to confirm active administrator privileges.
-- ==============================================================================

select
  p.id as user_id,
  u.email,
  u.email_confirmed_at,
  p.full_name,
  p.role,
  p.is_active,
  (select count(*) from public.profiles where role = 'admin' and is_active = true) as total_active_admins
from public.profiles p
join auth.users u on p.id = u.id
where p.role = 'admin';
