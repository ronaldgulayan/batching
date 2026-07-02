export type PaymentStatus = 'unpaid' | 'deposit' | 'paid';

export type Option = {
  id: string;
  label: string;
};

export type ModuleKey =
  | 'dashboard'
  | 'customers'
  | 'sales'
  | 'payments'
  | 'graba'
  | 'maintenance'
  | 'maintenance-designs'
  | 'maintenance-sites'
  | 'maintenance-sales'
  | 'maintenance-suppliers'
  | 'expenses'
  | 'masters';

export type SpreadsheetColumn = {
  title: string;
  type?: string;
  width?: number;
  readOnly?: boolean;
  source?: string[];
};
