create extension if not exists "pgcrypto";

create type payment_status as enum ('unpaid', 'deposit', 'paid');
create type check_status as enum ('pending', 'cleared', 'bounced', 'cancelled');
create type trip_status as enum ('scheduled', 'departed', 'arrived_site', 'pouring', 'completed', 'cancelled');
create type po_status as enum ('draft', 'approved', 'partially_paid', 'paid', 'cancelled');
create type maintenance_status as enum ('scheduled', 'in_progress', 'completed', 'cancelled');

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  phone text,
  email text,
  billing_address text,
  site_address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table concrete_designs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  strength_psi numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table project_sites (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  address text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sales_people (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  phone text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table customer_concrete_prices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  concrete_design_id uuid not null references concrete_designs(id) on delete cascade,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_concrete_prices_unique unique (customer_id, concrete_design_id)
);

create table sales_records (
  id uuid primary key default gen_random_uuid(),
  sale_or_number bigint not null unique,
  customer_id uuid references customers(id) on delete restrict,
  manual_customer_name text,
  concrete_design_id uuid not null references concrete_designs(id) on delete restrict,
  sale_date date not null,
  project_site text,
  cubic_volume numeric(12,2) not null check (cubic_volume >= 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  total_amount numeric(12,2) generated always as (cubic_volume * unit_price) stored,
  payment_status payment_status not null default 'unpaid',
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_has_customer check (
    customer_id is not null or nullif(trim(manual_customer_name), '') is not null
  )
);

create table sales_payments (
  id uuid primary key default gen_random_uuid(),
  sales_record_id uuid not null references sales_records(id) on delete cascade,
  payment_date date not null,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null,
  reference_number text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table graba_records (
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

create table graba_payments (
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

create table post_dated_checks (
  id uuid primary key default gen_random_uuid(),
  sales_record_id uuid references sales_records(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete restrict,
  check_number text not null,
  bank_name text,
  check_date date not null,
  amount numeric(12,2) not null check (amount > 0),
  status check_status not null default 'pending',
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pdc_has_sales_or_supplier check (
    sales_record_id is not null or supplier_id is not null
  )
);

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

create table drivers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  license_number text,
  license_expiry date,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table trucks (
  id uuid primary key default gen_random_uuid(),
  truck_number text not null unique,
  plate_number text unique,
  truck_type text,
  capacity_cubic numeric(12,2),
  current_odometer numeric(12,2) default 0 check (current_odometer >= 0),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table trip_logs (
  id uuid primary key default gen_random_uuid(),
  sales_record_id uuid references sales_records(id) on delete set null,
  truck_id uuid not null references trucks(id) on delete restrict,
  driver_id uuid references drivers(id) on delete set null,
  trip_date date not null,
  destination_site text,
  departure_time timestamptz,
  site_arrival_time timestamptz,
  pouring_start_time timestamptz,
  pouring_end_time timestamptz,
  return_time timestamptz,
  delivered_volume numeric(12,2) check (delivered_volume >= 0),
  status trip_status not null default 'scheduled',
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table fuel_logs (
  id uuid primary key default gen_random_uuid(),
  truck_id uuid not null references trucks(id) on delete restrict,
  fuel_date date not null,
  liters numeric(12,2) not null check (liters > 0),
  amount numeric(12,2) not null check (amount >= 0),
  odometer numeric(12,2) not null check (odometer >= 0),
  station_name text,
  receipt_number text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table raw_materials (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit text not null,
  reorder_level numeric(12,2) default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table raw_material_deliveries (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete restrict,
  raw_material_id uuid not null references raw_materials(id) on delete restrict,
  delivery_date date not null,
  quantity numeric(12,2) not null check (quantity > 0),
  unit_cost numeric(12,2) check (unit_cost >= 0),
  total_amount numeric(12,2) generated always as (quantity * coalesce(unit_cost, 0)) stored,
  delivery_receipt_number text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table maintenance_records (
  id uuid primary key default gen_random_uuid(),
  truck_id uuid not null references trucks(id) on delete restrict,
  maintenance_type text not null,
  scheduled_date date,
  completed_date date,
  odometer_at_service numeric(12,2) check (odometer_at_service >= 0),
  next_service_odometer numeric(12,2) check (next_service_odometer >= 0),
  cost numeric(12,2) default 0 check (cost >= 0),
  status maintenance_status not null default 'scheduled',
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tire_replacements (
  id uuid primary key default gen_random_uuid(),
  truck_id uuid not null references trucks(id) on delete restrict,
  replacement_date date not null,
  tire_position text,
  old_tire_serial_number text,
  new_tire_serial_number text not null,
  odometer numeric(12,2) check (odometer >= 0),
  cost numeric(12,2) default 0 check (cost >= 0),
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  expense_category_id uuid references expense_categories(id) on delete set null,
  supplier_id uuid references suppliers(id) on delete set null,
  expense_date date not null,
  description text not null,
  amount numeric(12,2) not null check (amount >= 0),
  payment_method text,
  reference_number text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete restrict,
  po_number text not null unique,
  po_date date not null,
  status po_status not null default 'draft',
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  raw_material_id uuid references raw_materials(id) on delete restrict,
  description text not null,
  quantity numeric(12,2) not null check (quantity > 0),
  unit text,
  unit_cost numeric(12,2) not null check (unit_cost >= 0),
  line_total numeric(12,2) generated always as (quantity * unit_cost) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table supplier_payments (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete restrict,
  purchase_order_id uuid references purchase_orders(id) on delete set null,
  payment_date date not null,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null,
  check_number text,
  bank_name text,
  check_date date,
  status check_status default 'pending',
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger customers_set_updated_at before update on customers for each row execute function set_updated_at();
create trigger suppliers_set_updated_at before update on suppliers for each row execute function set_updated_at();
create trigger concrete_designs_set_updated_at before update on concrete_designs for each row execute function set_updated_at();
create trigger project_sites_set_updated_at before update on project_sites for each row execute function set_updated_at();
create trigger sales_people_set_updated_at before update on sales_people for each row execute function set_updated_at();
create trigger customer_concrete_prices_set_updated_at before update on customer_concrete_prices for each row execute function set_updated_at();
create trigger sales_records_set_updated_at before update on sales_records for each row execute function set_updated_at();
create trigger sales_payments_set_updated_at before update on sales_payments for each row execute function set_updated_at();
create trigger graba_records_set_updated_at before update on graba_records for each row execute function set_updated_at();
create trigger graba_payments_set_updated_at before update on graba_payments for each row execute function set_updated_at();
create trigger post_dated_checks_set_updated_at before update on post_dated_checks for each row execute function set_updated_at();
create trigger drivers_set_updated_at before update on drivers for each row execute function set_updated_at();
create trigger trucks_set_updated_at before update on trucks for each row execute function set_updated_at();
create trigger trip_logs_set_updated_at before update on trip_logs for each row execute function set_updated_at();
create trigger fuel_logs_set_updated_at before update on fuel_logs for each row execute function set_updated_at();
create trigger raw_materials_set_updated_at before update on raw_materials for each row execute function set_updated_at();
create trigger raw_material_deliveries_set_updated_at before update on raw_material_deliveries for each row execute function set_updated_at();
create trigger maintenance_records_set_updated_at before update on maintenance_records for each row execute function set_updated_at();
create trigger tire_replacements_set_updated_at before update on tire_replacements for each row execute function set_updated_at();
create trigger expense_categories_set_updated_at before update on expense_categories for each row execute function set_updated_at();
create trigger expenses_set_updated_at before update on expenses for each row execute function set_updated_at();
create trigger purchase_orders_set_updated_at before update on purchase_orders for each row execute function set_updated_at();
create trigger purchase_order_items_set_updated_at before update on purchase_order_items for each row execute function set_updated_at();
create trigger supplier_payments_set_updated_at before update on supplier_payments for each row execute function set_updated_at();

create index idx_sales_records_customer_id on sales_records(customer_id);
create index idx_sales_records_sale_or_number on sales_records(sale_or_number);
create index idx_sales_records_sale_date on sales_records(sale_date);
create index idx_graba_records_supplier_id on graba_records(supplier_id);
create index idx_graba_records_dr_number on graba_records(graba_dr_number);
create index idx_graba_records_date on graba_records(graba_date);
create index idx_graba_payments_graba_record_id on graba_payments(graba_record_id);
create index idx_customer_concrete_prices_customer_id on customer_concrete_prices(customer_id);
create index idx_customer_concrete_prices_design_id on customer_concrete_prices(concrete_design_id);
create index idx_sales_payments_sales_record_id on sales_payments(sales_record_id);
create index idx_trip_logs_truck_id on trip_logs(truck_id);
create index idx_trip_logs_driver_id on trip_logs(driver_id);
create index idx_trip_logs_trip_date on trip_logs(trip_date);
create index idx_fuel_logs_truck_id on fuel_logs(truck_id);
create index idx_fuel_logs_fuel_date on fuel_logs(fuel_date);
create index idx_maintenance_records_truck_id on maintenance_records(truck_id);
create index idx_expenses_expense_date on expenses(expense_date);
create index idx_purchase_orders_supplier_id on purchase_orders(supplier_id);

alter table customers enable row level security;
alter table suppliers enable row level security;
alter table concrete_designs enable row level security;
alter table project_sites enable row level security;
alter table sales_people enable row level security;
alter table customer_concrete_prices enable row level security;
alter table sales_records enable row level security;
alter table sales_payments enable row level security;
alter table graba_records enable row level security;
alter table graba_payments enable row level security;
alter table post_dated_checks enable row level security;
alter table drivers enable row level security;
alter table trucks enable row level security;
alter table trip_logs enable row level security;
alter table fuel_logs enable row level security;
alter table raw_materials enable row level security;
alter table raw_material_deliveries enable row level security;
alter table maintenance_records enable row level security;
alter table tire_replacements enable row level security;
alter table expense_categories enable row level security;
alter table expenses enable row level security;
alter table purchase_orders enable row level security;
alter table purchase_order_items enable row level security;
alter table supplier_payments enable row level security;

create policy "authenticated manage customers" on customers for all to anon, authenticated using (true) with check (true);
create policy "authenticated manage suppliers" on suppliers for all to anon, authenticated using (true) with check (true);
create policy "authenticated manage concrete designs" on concrete_designs for all to anon, authenticated using (true) with check (true);
create policy "authenticated manage project sites" on project_sites for all to anon, authenticated using (true) with check (true);
create policy "authenticated manage sales people" on sales_people for all to anon, authenticated using (true) with check (true);
create policy "authenticated manage customer concrete prices" on customer_concrete_prices for all to anon, authenticated using (true) with check (true);
create policy "authenticated manage sales records" on sales_records for all to anon, authenticated using (true) with check (true);
create policy "authenticated manage sales payments" on sales_payments for all to anon, authenticated using (true) with check (true);
create policy "authenticated manage graba records" on graba_records for all to anon, authenticated using (true) with check (true);
create policy "authenticated manage graba payments" on graba_payments for all to anon, authenticated using (true) with check (true);
create policy "authenticated manage post dated checks" on post_dated_checks for all to anon, authenticated using (true) with check (true);
create policy "authenticated manage drivers" on drivers for all to anon, authenticated using (true) with check (true);
create policy "authenticated manage trucks" on trucks for all to anon, authenticated using (true) with check (true);
create policy "authenticated manage trip logs" on trip_logs for all to anon, authenticated using (true) with check (true);
create policy "authenticated manage fuel logs" on fuel_logs for all to anon, authenticated using (true) with check (true);
create policy "authenticated manage raw materials" on raw_materials for all to anon, authenticated using (true) with check (true);
create policy "authenticated manage raw material deliveries" on raw_material_deliveries for all to anon, authenticated using (true) with check (true);
create policy "authenticated manage maintenance records" on maintenance_records for all to anon, authenticated using (true) with check (true);
create policy "authenticated manage tire replacements" on tire_replacements for all to anon, authenticated using (true) with check (true);
create policy "authenticated manage expense categories" on expense_categories for all to anon, authenticated using (true) with check (true);
create policy "authenticated manage expenses" on expenses for all to anon, authenticated using (true) with check (true);
create policy "authenticated manage purchase orders" on purchase_orders for all to anon, authenticated using (true) with check (true);
create policy "authenticated manage purchase order items" on purchase_order_items for all to anon, authenticated using (true) with check (true);
create policy "authenticated manage supplier payments" on supplier_payments for all to anon, authenticated using (true) with check (true);
