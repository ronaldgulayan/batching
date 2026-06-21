create table if not exists customer_concrete_prices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  concrete_design_id uuid not null references concrete_designs(id) on delete cascade,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_concrete_prices_unique unique (customer_id, concrete_design_id)
);

alter table sales_records
  alter column customer_id drop not null;

alter table sales_records
  add column if not exists manual_customer_name text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sales_has_customer'
  ) then
    alter table sales_records
      add constraint sales_has_customer check (
        customer_id is not null or nullif(trim(manual_customer_name), '') is not null
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'customer_concrete_prices_set_updated_at'
  ) then
    create trigger customer_concrete_prices_set_updated_at
    before update on customer_concrete_prices
    for each row execute function set_updated_at();
  end if;
end $$;

create index if not exists idx_customer_concrete_prices_customer_id
  on customer_concrete_prices(customer_id);

create index if not exists idx_customer_concrete_prices_design_id
  on customer_concrete_prices(concrete_design_id);

alter table customer_concrete_prices enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where tablename = 'customer_concrete_prices'
      and policyname = 'authenticated manage customer concrete prices'
  ) then
    create policy "authenticated manage customer concrete prices"
    on customer_concrete_prices
    for all to authenticated
    using (true)
    with check (true);
  end if;
end $$;
