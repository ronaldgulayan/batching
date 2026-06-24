create table if not exists project_sites (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  address text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sales_people (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  phone text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists graba_records (
  id uuid primary key default gen_random_uuid(),
  graba_dr_number bigint not null unique,
  supplier_id uuid references suppliers(id) on delete restrict,
  manual_supplier_name text,
  graba_date date not null,
  items text not null,
  truck text,
  length_value numeric(12,2) not null default 0 check (length_value >= 0),
  width_value numeric(12,2) not null default 0 check (width_value >= 0),
  height_value numeric(12,2) not null default 0 check (height_value >= 0),
  cubic_volume numeric(12,2) generated always as (length_value * width_value * height_value) stored,
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  total_amount numeric(12,2) generated always as ((length_value * width_value * height_value) * unit_price) stored,
  payment_status payment_status not null default 'unpaid',
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint graba_has_supplier check (
    supplier_id is not null or nullif(trim(manual_supplier_name), '') is not null
  )
);

create table if not exists graba_payments (
  id uuid primary key default gen_random_uuid(),
  graba_record_id uuid not null references graba_records(id) on delete cascade,
  payment_date date not null,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null,
  reference_number text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table project_sites enable row level security;
alter table sales_people enable row level security;
alter table graba_records enable row level security;
alter table graba_payments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'project_sites'
      and policyname = 'authenticated manage project sites'
  ) then
    create policy "authenticated manage project sites"
      on project_sites for all to anon, authenticated using (true) with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sales_people'
      and policyname = 'authenticated manage sales people'
  ) then
    create policy "authenticated manage sales people"
      on sales_people for all to anon, authenticated using (true) with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'graba_records'
      and policyname = 'authenticated manage graba records'
  ) then
    create policy "authenticated manage graba records"
      on graba_records for all to anon, authenticated using (true) with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'graba_payments'
      and policyname = 'authenticated manage graba payments'
  ) then
    create policy "authenticated manage graba payments"
      on graba_payments for all to anon, authenticated using (true) with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'project_sites_set_updated_at'
  ) then
    create trigger project_sites_set_updated_at
      before update on project_sites
      for each row execute function set_updated_at();
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'graba_records_set_updated_at'
  ) then
    create trigger graba_records_set_updated_at
      before update on graba_records
      for each row execute function set_updated_at();
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'graba_payments_set_updated_at'
  ) then
    create trigger graba_payments_set_updated_at
      before update on graba_payments
      for each row execute function set_updated_at();
  end if;
end $$;

create index if not exists idx_graba_records_supplier_id on graba_records(supplier_id);
create index if not exists idx_graba_records_dr_number on graba_records(graba_dr_number);
create index if not exists idx_graba_records_date on graba_records(graba_date);
create index if not exists idx_graba_payments_graba_record_id on graba_payments(graba_record_id);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'sales_people_set_updated_at'
  ) then
    create trigger sales_people_set_updated_at
      before update on sales_people
      for each row execute function set_updated_at();
  end if;
end $$;

alter table sales_records
  add column if not exists sale_or_number bigint;

with numbered_sales as (
  select id, row_number() over (order by sale_date, created_at, id) as generated_or_number
  from sales_records
  where sale_or_number is null
)
update sales_records sr
set sale_or_number = numbered_sales.generated_or_number
from numbered_sales
where sr.id = numbered_sales.id;

alter table sales_records
  alter column sale_or_number set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sales_records_sale_or_number_key'
  ) then
    alter table sales_records
      add constraint sales_records_sale_or_number_key unique (sale_or_number);
  end if;
end $$;

create index if not exists idx_sales_records_sale_or_number on sales_records(sale_or_number);

drop view if exists sales_billing_summary;

create view sales_billing_summary as
select
  sr.id,
  sr.sale_or_number,
  sr.sale_date,
  sr.customer_id,
  coalesce(c.name, sr.manual_customer_name) as customer_name,
  sr.manual_customer_name,
  sr.concrete_design_id,
  cd.code as concrete_design,
  sr.cubic_volume,
  sr.unit_price,
  sr.total_amount,
  coalesce(sum(sp.amount), 0) as paid_amount,
  sr.total_amount - coalesce(sum(sp.amount), 0) as balance_amount,
  sr.payment_status
from sales_records sr
left join customers c on c.id = sr.customer_id
join concrete_designs cd on cd.id = sr.concrete_design_id
left join sales_payments sp on sp.sales_record_id = sr.id
group by sr.id, c.name, cd.code;

drop view if exists graba_summary;

create view graba_summary as
select
  gr.id,
  gr.graba_dr_number,
  gr.graba_date,
  gr.supplier_id,
  coalesce(s.name, gr.manual_supplier_name) as supplier_name,
  gr.items,
  gr.truck,
  gr.length_value,
  gr.width_value,
  gr.height_value,
  gr.cubic_volume,
  gr.unit_price,
  gr.total_amount,
  coalesce(sum(gp.amount), 0) as paid_amount,
  gr.total_amount - coalesce(sum(gp.amount), 0) as balance_amount,
  gr.payment_status,
  gr.remarks
from graba_records gr
left join suppliers s on s.id = gr.supplier_id
left join graba_payments gp on gp.graba_record_id = gr.id
group by gr.id, s.name;
