-- Drop existing view and tables to ensure a clean run
drop view if exists public.supplier_billing_summary;
drop table if exists public.supplier_payments cascade;
drop table if exists public.supplier_transactions cascade;

-- Create supplier_transactions table
create table public.supplier_transactions (
  id uuid primary key default gen_random_uuid(),
  dr_number text not null unique,
  transaction_date date not null,
  supplier_name text not null,
  item_name text not null,
  qty numeric(12,2) not null default 0 check (qty >= 0),
  price numeric(12,2) not null default 0 check (price >= 0),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'deposit', 'paid')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for supplier_transactions
alter table public.supplier_transactions enable row level security;
create policy "Allow all operations for authenticated users on supplier_transactions" 
  on public.supplier_transactions for all using (true) with check (true);

-- Create supplier_payments table
create table public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  supplier_transaction_id uuid not null references public.supplier_transactions(id) on delete cascade,
  payment_date date not null,
  amount numeric(12,2) not null check (amount > 0),
  ck_number text,
  po_number text,
  remarks text check (remarks in ('Paid', 'Collect')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for supplier_payments
alter table public.supplier_payments enable row level security;
create policy "Allow all operations for authenticated users on supplier_payments" 
  on public.supplier_payments for all using (true) with check (true);

-- Create summary view for supplier billing
create or replace view public.supplier_billing_summary as
select
  st.id,
  st.dr_number,
  st.transaction_date,
  st.supplier_name,
  st.item_name,
  st.qty,
  st.price,
  st.total_amount,
  coalesce(sum(sp.amount), 0) as paid_amount,
  st.total_amount - coalesce(sum(sp.amount), 0) as balance_amount,
  st.payment_status
from supplier_transactions st
left join supplier_payments sp on sp.supplier_transaction_id = st.id
group by st.id;
