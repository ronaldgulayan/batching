import {
  ClipboardList,
  Gauge,
  Landmark,
  ReceiptText,
  Truck,
  UsersRound,
} from "lucide-react";
import type { ModuleKey, SpreadsheetColumn } from "../types";

export type SpreadsheetModuleConfig = {
  key: Extract<ModuleKey, "expenses">;
  title: string;
  table: string;
  dateColumn: string;
  icon: typeof ClipboardList;
  columns: SpreadsheetColumn[];
  toRow: (record: Record<string, unknown>) => unknown[];
  toRecord: (row: unknown[]) => Record<string, unknown> | null;
};

const text = (value: unknown) => String(value ?? "").trim();
const optionalText = (value: unknown) => {
  const cleaned = text(value);
  return cleaned || null;
};
const numberValue = (value: unknown) => Number(value || 0);

export const modules: SpreadsheetModuleConfig[] = [
  {
    key: "expenses",
    title: "Expenses",
    table: "expenses",
    dateColumn: "expense_date",
    icon: ClipboardList,
    columns: [
      { title: "ID", type: "text", width: 230, readOnly: true },
      { title: "Date", type: "calendar", width: 120 },
      { title: "Category ID", type: "text", width: 250 },
      { title: "Supplier ID", type: "text", width: 250 },
      { title: "Description", type: "text", width: 260 },
      { title: "Amount", type: "numeric", width: 120 },
      { title: "Payment Method", type: "text", width: 160 },
      { title: "Reference No.", type: "text", width: 160 },
      { title: "Remarks", type: "text", width: 220 },
    ],
    toRow: (record) => [
      record.id,
      record.expense_date,
      record.expense_category_id,
      record.supplier_id,
      record.description,
      record.amount,
      record.payment_method,
      record.reference_number,
      record.remarks,
    ],
    toRecord: (row) => {
      if (!row[1] || !row[4]) return null;
      return {
        id: optionalText(row[0]) || undefined,
        expense_date: text(row[1]),
        expense_category_id: optionalText(row[2]),
        supplier_id: optionalText(row[3]),
        description: text(row[4]),
        amount: numberValue(row[5]),
        payment_method: optionalText(row[6]),
        reference_number: optionalText(row[7]),
        remarks: optionalText(row[8]),
      };
    },
  },
];

export const navItems = [
  {
    key: "dashboard" as const,
    label: "Dashboard",
    icon: Gauge,
  },
  {
    key: "sales" as const,
    label: "Sales",
    icon: ReceiptText,
  },
  {
    key: "payments" as const,
    label: "Payment",
    icon: Landmark,
  },
  {
    key: "customers" as const,
    label: "Clients",
    icon: UsersRound,
  },
  {
    key: "graba" as const,
    label: "GRABA",
    icon: Truck,
  },
  {
    key: "suppliers" as const,
    label: "Supplier",
    icon: Landmark,
  },
  {
    key: "expenses" as const,
    label: "Expenses",
    icon: ClipboardList,
  },
];

export const maintenanceNavItems = [
  {
    key: "maintenance-designs" as const,
    label: "Design",
    icon: ClipboardList,
  },
  {
    key: "maintenance-sites" as const,
    label: "Sites",
    icon: Truck,
  },
  {
    key: "maintenance-sales" as const,
    label: "Sales",
    icon: UsersRound,
  },
  {
    key: "maintenance-graba-items" as const,
    label: "Items",
    icon: ClipboardList,
  },
  {
    key: "maintenance-graba-trucks" as const,
    label: "Trucks",
    icon: Truck,
  },
];
