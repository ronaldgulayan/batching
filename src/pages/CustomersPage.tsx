import { useEffect, useState } from "react";
import { Alert, Button, Stack } from "@mantine/core";
import { AlertCircle, RefreshCw } from "lucide-react";
import {
  CustomExcelTable,
  type ExcelColumn,
} from "../components/CustomExcelTable";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

type ClientRow = {
  id: string;
  client_name: string;
  sale_or_number: number;
  sale_date: string;
  design: string;
  cubic_volume: number;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  payment_status: string;
};

type SummaryRecord = {
  id: string;
  sale_or_number: number | null;
  sale_date: string;
  customer_name: string | null;
  concrete_design: string | null;
  cubic_volume: number;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  payment_status: string;
};

const columns: ExcelColumn<ClientRow>[] = [
  { key: "client_name", label: "Client", width: 150, sortable: true },
  {
    key: "sale_or_number",
    label: "OR",
    type: "number",
    width: 70,
    sortable: true,
  },
  { key: "sale_date", label: "Date", type: "date", width: 110, sortable: true },
  { key: "design", label: "Design", width: 170, sortable: true },
  {
    key: "cubic_volume",
    label: "Cubic",
    type: "number",
    width: 80,
    sortable: true,
  },
  {
    key: "total_amount",
    label: "Total",
    type: "number",
    width: 110,
    sortable: true,
  },
  {
    key: "paid_amount",
    label: "Paid",
    type: "number",
    width: 110,
    sortable: true,
  },
  {
    key: "balance_amount",
    label: "Unpaid",
    type: "number",
    width: 130,
    sortable: true,
  },
  { key: "payment_status", label: "Status", width: 120, sortable: true },
];

export function CustomersPage() {
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadClients() {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError("");

    const { data, error: loadError } = await supabase
      .from("sales_billing_summary")
      .select(
        "id,sale_or_number,sale_date,customer_name,concrete_design,cubic_volume,total_amount,paid_amount,balance_amount,payment_status",
      )
      .order("sale_date", { ascending: false });

    setLoading(false);

    if (loadError) {
      setError(loadError.message);
      return;
    }

    setRows(
      ((data ?? []) as unknown as SummaryRecord[]).map((record) => ({
        id: record.id,
        client_name: record.customer_name ?? "",
        sale_or_number: Number(record.sale_or_number || 0),
        sale_date: record.sale_date,
        design: record.concrete_design ?? "",
        cubic_volume: Number(record.cubic_volume || 0),
        total_amount: Number(record.total_amount || 0),
        paid_amount: Number(record.paid_amount || 0),
        balance_amount: Number(record.balance_amount || 0),
        payment_status: record.payment_status,
      })),
    );
  }

  useEffect(() => {
    void loadClients();
  }, []);

  return (
    <Stack gap="md">
      <div className="formActions">
        <Button
          leftSection={<RefreshCw size={16} />}
          variant="light"
          onClick={loadClients}
          loading={loading}
        >
          Refresh
        </Button>
      </div>

      {!isSupabaseConfigured && (
        <Alert
          icon={<AlertCircle size={16} />}
          color="yellow"
          title="Supabase is not configured"
        >
          Supabase credentials are missing from .env.
        </Alert>
      )}

      {error && (
        <Alert
          icon={<AlertCircle size={16} />}
          color="red"
          title="Database error"
        >
          {error}
        </Alert>
      )}

      <CustomExcelTable columns={columns} data={rows} />
    </Stack>
  );
}
