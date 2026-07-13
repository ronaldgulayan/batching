-- Simplify expenses table by dropping columns not needed for the simple version
-- Keep only: id, expense_date, description, amount, remarks, created_at, updated_at

alter table expenses 
  drop column if exists expense_category_id,
  drop column if exists supplier_id,
  drop column if exists payment_method,
  drop column if exists reference_number;
