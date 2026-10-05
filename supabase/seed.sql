-- =============================================================================
-- Local development accounts, applied by `supabase start` / `supabase db reset`.
-- `supabase db push` never runs seeds, so these never reach a hosted project.
--
--   admin@example.com  / password123   admin + verified minister (hosts studies, posts notices)
--   member@example.com / password123   regular member
-- =============================================================================

-- GoTrue reads these token columns as strings, so they must be '' rather than NULL.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}', jsonb_build_object('display_name', u.display_name),
  now(), now(),
  '', '', '', ''
from (values
  ('00000000-0000-0000-0000-00000000a001'::uuid, 'admin@example.com', 'Admin'),
  ('00000000-0000-0000-0000-00000000a002'::uuid, 'member@example.com', 'Member')
) as u (id, email, display_name);

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(), id, id::text, 'email',
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  now(), now(), now()
from auth.users
where email in ('admin@example.com', 'member@example.com');

-- The signup trigger already created both profiles; promote the admin.
update public.profiles
   set role = 'admin', is_minister = true
 where id = '00000000-0000-0000-0000-00000000a001';
