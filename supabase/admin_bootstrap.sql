-- FAW-AI Administrator Bootstrap Helper
-- Run this query in your Supabase SQL Editor after the administrator registers their account.

-- Replace 'admin@institution.edu' with the email address of the administrator account:
update public.profiles
set role = 'admin', is_active = true
where id in (
  select id from auth.users where lower(email) = lower('admin@institution.edu')
);

-- Verification:
select p.id, p.full_name, p.role, p.is_active, u.email
from public.profiles p
join auth.users u on p.id = u.id
where p.role = 'admin';
