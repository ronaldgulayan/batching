-- Add pumpcreate column to concrete_designs if it doesn't exist
alter table concrete_designs add column if not exists pumpcreate numeric(12,2);

-- Add pumpcreate column to sales_records if it doesn't exist
alter table sales_records add column if not exists pumpcreate numeric(12,2);
