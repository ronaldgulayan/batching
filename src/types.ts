export type PaymentStatus = 'unpaid' | 'deposit' | 'paid';

export type Option = {
  id: string;
  label: string;
};

export type ModuleKey =
  | 'customers'
  | 'sales'
  | 'pricing'
  | 'dispatch'
  | 'fuel'
  | 'maintenance'
  | 'expenses'
  | 'masters';

export type SpreadsheetColumn = {
  title: string;
  type?: string;
  width?: number;
  readOnly?: boolean;
  source?: string[];
};
