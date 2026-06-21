do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and (
        policyname like 'authenticated manage %'
        or policyname like 'dev manage %'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end $$;

create policy "dev manage customers" on customers for all to anon, authenticated using (true) with check (true);
create policy "dev manage suppliers" on suppliers for all to anon, authenticated using (true) with check (true);
create policy "dev manage concrete designs" on concrete_designs for all to anon, authenticated using (true) with check (true);
create policy "dev manage customer concrete prices" on customer_concrete_prices for all to anon, authenticated using (true) with check (true);
create policy "dev manage sales records" on sales_records for all to anon, authenticated using (true) with check (true);
create policy "dev manage sales payments" on sales_payments for all to anon, authenticated using (true) with check (true);
create policy "dev manage post dated checks" on post_dated_checks for all to anon, authenticated using (true) with check (true);
create policy "dev manage drivers" on drivers for all to anon, authenticated using (true) with check (true);
create policy "dev manage trucks" on trucks for all to anon, authenticated using (true) with check (true);
create policy "dev manage trip logs" on trip_logs for all to anon, authenticated using (true) with check (true);
create policy "dev manage fuel logs" on fuel_logs for all to anon, authenticated using (true) with check (true);
create policy "dev manage raw materials" on raw_materials for all to anon, authenticated using (true) with check (true);
create policy "dev manage raw material deliveries" on raw_material_deliveries for all to anon, authenticated using (true) with check (true);
create policy "dev manage maintenance records" on maintenance_records for all to anon, authenticated using (true) with check (true);
create policy "dev manage tire replacements" on tire_replacements for all to anon, authenticated using (true) with check (true);
create policy "dev manage expense categories" on expense_categories for all to anon, authenticated using (true) with check (true);
create policy "dev manage expenses" on expenses for all to anon, authenticated using (true) with check (true);
create policy "dev manage purchase orders" on purchase_orders for all to anon, authenticated using (true) with check (true);
create policy "dev manage purchase order items" on purchase_order_items for all to anon, authenticated using (true) with check (true);
create policy "dev manage supplier payments" on supplier_payments for all to anon, authenticated using (true) with check (true);
