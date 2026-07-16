-- Drop dependent view first
drop view if exists public.graba_summary;

-- Alter column to text type
alter table public.graba_records alter column graba_dr_number type text;

-- Recreate view graba_summary
create or replace view public.graba_summary as
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
