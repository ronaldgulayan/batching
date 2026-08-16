-- ==============================================================================
-- SUPABASE USER MAINTENANCE & PROFILES SETUP SCRIPT
-- Copy and paste this script into your Supabase SQL Editor.
-- ==============================================================================

-- 1. Enable pgcrypto extension for secure password hashing
create extension if not exists "pgcrypto";

-- 2. Create public.profiles table if it does not exist
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text default 'staff',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

-- Drop existing policies if re-running
drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
drop policy if exists "Users and Admins can update profiles" on public.profiles;

-- Create policies for profiles
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  using (true);

create policy "Users and Admins can update profiles"
  on public.profiles for all
  using (true)
  with check (true);

-- 4. Create trigger to automatically create a public.profiles entry whenever a user is added to auth.users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'staff')
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    role = excluded.role,
    updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

-- Re-create trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==============================================================================
-- RPC FUNCTIONS FOR FRONTEND USER MAINTENANCE PAGE (CRUD)
-- ==============================================================================

-- Function 1: Admin Create User (Adds user to auth.users AND public.profiles)
create or replace function public.admin_create_user(
  p_email text,
  p_password text default '123456789',
  p_full_name text default null,
  p_role text default 'staff'
) returns json as $$
declare
  v_new_user_id uuid := gen_random_uuid();
  v_encrypted_password text;
begin
  -- Hash password using bcrypt
  v_encrypted_password := extensions.crypt(p_password, extensions.gen_salt('bf'));

  -- Insert directly into Supabase auth.users table
  insert into auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    aud,
    role,
    created_at,
    updated_at
  ) values (
    v_new_user_id,
    '00000000-0000-0000-0000-000000000000',
    p_email,
    v_encrypted_password,
    now(),
    jsonb_build_object('full_name', p_full_name, 'role', p_role),
    'authenticated',
    'authenticated',
    now(),
    now()
  );

  -- Upsert into public.profiles
  insert into public.profiles (id, email, full_name, role)
  values (
    v_new_user_id,
    p_email,
    coalesce(p_full_name, split_part(p_email, '@', 1)),
    coalesce(p_role, 'staff')
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    role = excluded.role,
    updated_at = now();

  return json_build_object('success', true, 'user_id', v_new_user_id);
exception when others then
  return json_build_object('success', false, 'error', SQLERRM);
end;
$$ language plpgsql security definer;

-- Function 2: Admin Update User
create or replace function public.admin_update_user(
  p_user_id uuid,
  p_full_name text,
  p_role text
) returns json as $$
begin
  update public.profiles
  set
    full_name = p_full_name,
    role = p_role,
    updated_at = now()
  where id = p_user_id;

  update auth.users
  set raw_user_meta_data = jsonb_set(
    coalesce(raw_user_meta_data, '{}'::jsonb),
    '{full_name}',
    to_jsonb(p_full_name)
  )
  where id = p_user_id;

  return json_build_object('success', true);
exception when others then
  return json_build_object('success', false, 'error', SQLERRM);
end;
$$ language plpgsql security definer;

-- Function 3: Admin Delete User
create or replace function public.admin_delete_user(
  p_user_id uuid
) returns json as $$
begin
  delete from auth.users where id = p_user_id;
  delete from public.profiles where id = p_user_id;
  return json_build_object('success', true);
exception when others then
  return json_build_object('success', false, 'error', SQLERRM);
end;
$$ language plpgsql security definer;
