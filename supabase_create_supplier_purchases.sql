-- Create table for Supplier Purchases / Expenses
create table if not exists public.supplier_purchases (
  id uuid primary key default gen_random_uuid(),
  purchase_date date not null default current_date,
  delivery_receipt_no text not null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  item_name text not null,
  quantity numeric(12,2) not null default 0 check (quantity >= 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  total_amount numeric(12,2) generated always as (quantity * unit_price) stored,
  check_number text,
  check_amount numeric(12,2) check (check_amount >= 0),
  check_date date,
  remarks text not null default 'COLLECT',
  po_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.supplier_purchases enable row level security;

-- Create policy for public/dev access (same as other tables in dev mode)
drop policy if exists "dev manage supplier purchases" on public.supplier_purchases;
create policy "dev manage supplier purchases" on public.supplier_purchases
  for all to anon, authenticated
  using (true)
  with check (true);

-- Create trigger for updated_at
drop trigger if exists supplier_purchases_set_updated_at on public.supplier_purchases;
create trigger supplier_purchases_set_updated_at
  before update on public.supplier_purchases
  for each row
  execute function public.set_updated_at();

-- Add indices for faster lookup
create index if not exists idx_supplier_purchases_supplier_id on public.supplier_purchases(supplier_id);
create index if not exists idx_supplier_purchases_purchase_date on public.supplier_purchases(purchase_date);
create index if not exists idx_supplier_purchases_delivery_receipt on public.supplier_purchases(delivery_receipt_no);
