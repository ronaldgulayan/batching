import {
  ClipboardList,
  Fuel,
  HandCoins,
  ReceiptText,
  Truck,
  UsersRound,
  Wrench,
} from 'lucide-react';
import type { ModuleKey, SpreadsheetColumn } from '../types';

export type SpreadsheetModuleConfig = {
  key: Extract<ModuleKey, 'dispatch' | 'fuel' | 'maintenance' | 'expenses'>;
  title: string;
  table: string;
  dateColumn: string;
  icon: typeof ClipboardList;
  columns: SpreadsheetColumn[];
  toRow: (record: Record<string, unknown>) => unknown[];
  toRecord: (row: unknown[]) => Record<string, unknown> | null;
};

const text = (value: unknown) => String(value ?? '').trim();
const optionalText = (value: unknown) => {
  const cleaned = text(value);
  return cleaned || null;
};
const numberValue = (value: unknown) => Number(value || 0);

export const modules: SpreadsheetModuleConfig[] = [
  {
    key: 'dispatch',
    title: 'Fleet and Dispatch',
    table: 'trip_logs',
    dateColumn: 'trip_date',
    icon: Truck,
    columns: [
      { title: 'ID', type: 'text', width: 230, readOnly: true },
      { title: 'Date', type: 'calendar', width: 120 },
      { title: 'Truck ID', type: 'text', width: 250 },
      { title: 'Driver ID', type: 'text', width: 250 },
      { title: 'Sales Record ID', type: 'text', width: 250 },
      { title: 'Destination Site', type: 'text', width: 190 },
      { title: 'Departure', type: 'text', width: 160 },
      { title: 'Site Arrival', type: 'text', width: 160 },
      { title: 'Pouring Start', type: 'text', width: 160 },
      { title: 'Pouring End', type: 'text', width: 160 },
      { title: 'Delivered m3', type: 'numeric', width: 120 },
      {
        title: 'Status',
        type: 'dropdown',
        width: 140,
        source: ['scheduled', 'departed', 'arrived_site', 'pouring', 'completed', 'cancelled'],
      },
      { title: 'Remarks', type: 'text', width: 220 },
    ],
    toRow: (record) => [
      record.id,
      record.trip_date,
      record.truck_id,
      record.driver_id,
      record.sales_record_id,
      record.destination_site,
      record.departure_time,
      record.site_arrival_time,
      record.pouring_start_time,
      record.pouring_end_time,
      record.delivered_volume,
      record.status,
      record.remarks,
    ],
    toRecord: (row) => {
      if (!row[1] || !row[2]) return null;
      return {
        id: optionalText(row[0]) || undefined,
        trip_date: text(row[1]),
        truck_id: text(row[2]),
        driver_id: optionalText(row[3]),
        sales_record_id: optionalText(row[4]),
        destination_site: optionalText(row[5]),
        departure_time: optionalText(row[6]),
        site_arrival_time: optionalText(row[7]),
        pouring_start_time: optionalText(row[8]),
        pouring_end_time: optionalText(row[9]),
        delivered_volume: row[10] === '' ? null : numberValue(row[10]),
        status: text(row[11]) || 'scheduled',
        remarks: optionalText(row[12]),
      };
    },
  },
  {
    key: 'fuel',
    title: 'Fuel and Inventory',
    table: 'fuel_logs',
    dateColumn: 'fuel_date',
    icon: Fuel,
    columns: [
      { title: 'ID', type: 'text', width: 230, readOnly: true },
      { title: 'Date', type: 'calendar', width: 120 },
      { title: 'Truck ID', type: 'text', width: 250 },
      { title: 'Liters', type: 'numeric', width: 120 },
      { title: 'Amount', type: 'numeric', width: 120 },
      { title: 'Odometer', type: 'numeric', width: 120 },
      { title: 'Station', type: 'text', width: 180 },
      { title: 'Receipt No.', type: 'text', width: 160 },
      { title: 'Remarks', type: 'text', width: 220 },
    ],
    toRow: (record) => [
      record.id,
      record.fuel_date,
      record.truck_id,
      record.liters,
      record.amount,
      record.odometer,
      record.station_name,
      record.receipt_number,
      record.remarks,
    ],
    toRecord: (row) => {
      if (!row[1] || !row[2]) return null;
      return {
        id: optionalText(row[0]) || undefined,
        fuel_date: text(row[1]),
        truck_id: text(row[2]),
        liters: numberValue(row[3]),
        amount: numberValue(row[4]),
        odometer: numberValue(row[5]),
        station_name: optionalText(row[6]),
        receipt_number: optionalText(row[7]),
        remarks: optionalText(row[8]),
      };
    },
  },
  {
    key: 'maintenance',
    title: 'Preventive Maintenance',
    table: 'maintenance_records',
    dateColumn: 'scheduled_date',
    icon: Wrench,
    columns: [
      { title: 'ID', type: 'text', width: 230, readOnly: true },
      { title: 'Truck ID', type: 'text', width: 250 },
      { title: 'Type', type: 'text', width: 190 },
      { title: 'Scheduled Date', type: 'calendar', width: 130 },
      { title: 'Completed Date', type: 'calendar', width: 130 },
      { title: 'Odometer', type: 'numeric', width: 120 },
      { title: 'Next Odometer', type: 'numeric', width: 140 },
      { title: 'Cost', type: 'numeric', width: 120 },
      {
        title: 'Status',
        type: 'dropdown',
        width: 130,
        source: ['scheduled', 'in_progress', 'completed', 'cancelled'],
      },
      { title: 'Remarks', type: 'text', width: 220 },
    ],
    toRow: (record) => [
      record.id,
      record.truck_id,
      record.maintenance_type,
      record.scheduled_date,
      record.completed_date,
      record.odometer_at_service,
      record.next_service_odometer,
      record.cost,
      record.status,
      record.remarks,
    ],
    toRecord: (row) => {
      if (!row[1] || !row[2]) return null;
      return {
        id: optionalText(row[0]) || undefined,
        truck_id: text(row[1]),
        maintenance_type: text(row[2]),
        scheduled_date: optionalText(row[3]),
        completed_date: optionalText(row[4]),
        odometer_at_service: row[5] === '' ? null : numberValue(row[5]),
        next_service_odometer: row[6] === '' ? null : numberValue(row[6]),
        cost: numberValue(row[7]),
        status: text(row[8]) || 'scheduled',
        remarks: optionalText(row[9]),
      };
    },
  },
  {
    key: 'expenses',
    title: 'Expenses and Purchasing',
    table: 'expenses',
    dateColumn: 'expense_date',
    icon: ClipboardList,
    columns: [
      { title: 'ID', type: 'text', width: 230, readOnly: true },
      { title: 'Date', type: 'calendar', width: 120 },
      { title: 'Category ID', type: 'text', width: 250 },
      { title: 'Supplier ID', type: 'text', width: 250 },
      { title: 'Description', type: 'text', width: 260 },
      { title: 'Amount', type: 'numeric', width: 120 },
      { title: 'Payment Method', type: 'text', width: 160 },
      { title: 'Reference No.', type: 'text', width: 160 },
      { title: 'Remarks', type: 'text', width: 220 },
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
    key: 'customers' as const,
    label: 'Customers',
    icon: UsersRound,
  },
  {
    key: 'sales' as const,
    label: 'Sales and Billing',
    icon: ReceiptText,
  },
  {
    key: 'pricing' as const,
    label: 'Customer Prices',
    icon: HandCoins,
  },
  {
    key: 'dispatch' as const,
    label: 'Fleet and Dispatch',
    icon: Truck,
  },
  {
    key: 'fuel' as const,
    label: 'Fuel and Inventory',
    icon: Fuel,
  },
  {
    key: 'maintenance' as const,
    label: 'Preventive Maintenance',
    icon: Wrench,
  },
  {
    key: 'expenses' as const,
    label: 'Expenses and Purchasing',
    icon: ClipboardList,
  },
  {
    key: 'masters' as const,
    label: 'Other Master Data',
    icon: UsersRound,
  },
];
