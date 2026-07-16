-- Create lookup table for Graba items
create table if not exists public.graba_items (
  id uuid primary key default gen_random_uuid(),
  item text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS for Graba items
alter table public.graba_items enable row level security;

-- Drop existing policy if exists
drop policy if exists "dev manage graba_items" on public.graba_items;

-- Create dev policy
create policy "dev manage graba_items" on public.graba_items 
  for all to anon, authenticated using (true) with check (true);

-- Create lookup table for Graba trucks
create table if not exists public.graba_trucks (
  id uuid primary key default gen_random_uuid(),
  truck text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS for Graba trucks
alter table public.graba_trucks enable row level security;

-- Drop existing policy if exists
drop policy if exists "dev manage graba_trucks" on public.graba_trucks;

-- Create dev policy
create policy "dev manage graba_trucks" on public.graba_trucks 
  for all to anon, authenticated using (true) with check (true);

-- Add new payment/check columns to graba_records
alter table public.graba_records add column if not exists check_no text;
alter table public.graba_records add column if not exists amount numeric(12,2);
alter table public.graba_records add column if not exists date date;
