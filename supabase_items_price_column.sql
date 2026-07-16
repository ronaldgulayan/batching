-- Add price column to graba_items lookup table
alter table public.graba_items add column if not exists price numeric(12,2) not null default 0 check (price >= 0);
