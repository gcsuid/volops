-- VolOps demo seed data
-- Run this in Supabase SQL Editor AFTER running schema.sql.
--
-- Creates one demo volunteer account you can use to log in immediately:
--   Email   : demo.volunteer@volops.dev
--   Password: Demo@Volops1
--
-- The auth.users row is inserted directly so the account is already
-- confirmed and ready to use without any email verification step.
--
-- Requires: pgcrypto extension (already enabled by schema.sql via
--   "create extension if not exists pgcrypto").

-- ─────────────────────────────────────────────────────────────────────────────
-- Demo volunteer – auth identity
-- ─────────────────────────────────────────────────────────────────────────────

-- Fixed UUID so the volunteers profile row can reference it safely.
do $$
declare
  v_id uuid := '00000000-0000-0000-0000-000000000001';
begin

  -- Create the Supabase Auth user if it does not already exist.
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_sent_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) values (
    v_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'demo.volunteer@volops.dev',
    crypt('Demo@Volops1', gen_salt('bf')),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '', '', '', ''
  )
  on conflict (id) do nothing;

  -- Insert the matching row in the identities table that Supabase requires
  -- for email/password logins (skip if it already exists).
  insert into auth.identities (
    id,
    user_id,
    provider_id,
    provider,
    identity_data,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    v_id,
    v_id,
    'demo.volunteer@volops.dev',
    'email',
    json_build_object('sub', v_id::text, 'email', 'demo.volunteer@volops.dev'),
    now(),
    now(),
    now()
  )
  on conflict (provider, provider_id) do nothing;

  -- Create the volunteer profile row.
  insert into public.volunteers (id, vol_id, name, email, age, gender)
  values (
    v_id,
    'VOL-DEMO-001',
    'Demo Volunteer',
    'demo.volunteer@volops.dev',
    25,
    'Other'
  )
  on conflict (id) do nothing;

end $$;
