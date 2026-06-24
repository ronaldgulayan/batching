import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Group,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  TextInput,
} from "@mantine/core";
import { AlertCircle, RefreshCw, Save } from "lucide-react";
import { CustomExcelTable, type ExcelColumn } from "../components/CustomExcelTable";
import { SuggestionTextInput } from "../components/SuggestionTextInput";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

type TargetType = "sales" | "graba";

type PaymentTarget = {
  id: string;
  type: TargetType;
  label: string;
  total_amount: number;
  paid_amount: number;
};

type PaymentRow = {
  id: string;
  source: string;
  document_number: string;
  account_name: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number: string;
  remarks: string;
};

type SalesSummaryRecord = {
  id: string;
  sale_or_number: number | null;
  customer_name: string | null;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
};

type GrabaSummaryRecord = {
  id: string;
  graba_dr_number: number | null;
  supplier_name: string | null;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
};

type SalesPaymentRecord = {
  id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  remarks: string | null;
  sales_records?:
    | {
        sale_or_number: number | null;
        manual_customer_name: string | null;
        customers?: { name: string } | { name: string }[] | null;
      }
    | {
        sale_or_number: number | null;
        manual_customer_name: string | null;
        customers?: { name: string } | { name: string }[] | null;
      }[]
    | null;
};

type GrabaPaymentRecord = {
  id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  remarks: string | null;
  graba_records?:
    | {
        graba_dr_number: number | null;
        manual_supplier_name: string | null;
        suppliers?: { name: string } | { name: string }[] | null;
      }
    | {
        graba_dr_number: number | null;
        manual_supplier_name: string | null;
        suppliers?: { name: string } | { name: string }[] | null;
      }[]
    | null;
};

type PaymentForm = {
  target_id: string | null;
  target_type: TargetType | null;
  target_label: string;
  payment_date: string;
  amount: number | "";
  payment_method: string;
  reference_number: string;
  remarks: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm: PaymentForm = {
  target_id: null,
  target_type: null,
  target_label: "",
  payment_date: today(),
  amount: "",
  payment_method: "cash",
  reference_number: "",
  remarks: "",
};

const columns: ExcelColumn<PaymentRow>[] = [
  { key: "source", label: "Source", width: 100, sortable: true },
  { key: "document_number", label: "Doc No", width: 120, sortable: true },
  { key: "account_name", label: "Name", width: 220, sortable: true },
  { key: "payment_date", label: "Date", type: "date", width: 120, sortable: true },
  { key: "amount", label: "Amount", type: "number", width: 140, sortable: true },
  { key: "payment_method", label: "Method", width: 130, sortable: true },
  { key: "reference_number", label: "Reference", width: 160, sortable: true },
  { key: "remarks", label: "Remarks", width: 240 },
];

const salesCustomer = (value: SalesPaymentRecord["sales_records"]) => {
  const record = Array.isArray(value) ? value[0] : value;
  const customer = Array.isArray(record?.customers) ? record?.customers[0]?.name : record?.customers?.name;
  return customer ?? record?.manual_customer_name ?? "";
};

const salesOr = (value: SalesPaymentRecord["sales_records"]) => {
  const record = Array.isArray(value) ? value[0] : value;
  return `OR ${record?.sale_or_number ?? ""}`;
};

const grabaSupplier = (value: GrabaPaymentRecord["graba_records"]) => {
  const record = Array.isArray(value) ? value[0] : value;
  const supplier = Array.isArray(record?.suppliers) ? record?.suppliers[0]?.name : record?.suppliers?.name;
  return supplier ?? record?.manual_supplier_name ?? "";
};

const grabaDr = (value: GrabaPaymentRecord["graba_records"]) => {
  const record = Array.isArray(value) ? value[0] : value;
  return `DR ${record?.graba_dr_number ?? ""}`;
};

export function PaymentsPage() {
  const [targets, setTargets] = useState<PaymentTarget[]>([]);
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [form, setForm] = useState<PaymentForm>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadRows() {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const [salesSummary, grabaSummary, salesPayments, grabaPayments] = await Promise.all([
        supabase
          .from("sales_billing_summary")
          .select("id,sale_or_number,customer_name,total_amount,paid_amount,balance_amount")
          .order("sale_or_number", { ascending: false }),
        supabase
          .from("graba_summary")
          .select("id,graba_dr_number,supplier_name,total_amount,paid_amount,balance_amount")
          .order("graba_dr_number", { ascending: false }),
        supabase
          .from("sales_payments")
          .select(
            "id,payment_date,amount,payment_method,reference_number,remarks,sales_records(sale_or_number,manual_customer_name,customers(name))",
          )
          .order("payment_date", { ascending: false })
          .limit(300),
        supabase
          .from("graba_payments")
          .select(
            "id,payment_date,amount,payment_method,reference_number,remarks,graba_records(graba_dr_number,manual_supplier_name,suppliers(name))",
          )
          .order("payment_date", { ascending: false })
          .limit(300),
      ]);

      const firstError =
        salesSummary.error ?? grabaSummary.error ?? salesPayments.error ?? grabaPayments.error;
      if (firstError) throw new Error(firstError.message);

      const salesTargets = ((salesSummary.data ?? []) as unknown as SalesSummaryRecord[]).map((sale) => ({
        id: sale.id,
        type: "sales" as const,
        label: `Sales - OR ${sale.sale_or_number ?? "-"} - ${sale.customer_name ?? "No client"} - Balance PHP ${Number(
          sale.balance_amount || 0,
        ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        total_amount: Number(sale.total_amount || 0),
        paid_amount: Number(sale.paid_amount || 0),
      }));

      const grabaTargets = ((grabaSummary.data ?? []) as unknown as GrabaSummaryRecord[]).map((graba) => ({
        id: graba.id,
        type: "graba" as const,
        label: `GRABA - DR ${graba.graba_dr_number ?? "-"} - ${graba.supplier_name ?? "No supplier"} - Balance PHP ${Number(
          graba.balance_amount || 0,
        ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        total_amount: Number(graba.total_amount || 0),
        paid_amount: Number(graba.paid_amount || 0),
      }));

      setTargets([...salesTargets, ...grabaTargets]);

      const saleRows = ((salesPayments.data ?? []) as unknown as SalesPaymentRecord[]).map((payment) => ({
        id: `sales-${payment.id}`,
        source: "Sales",
        document_number: salesOr(payment.sales_records),
        account_name: salesCustomer(payment.sales_records),
        payment_date: payment.payment_date,
        amount: Number(payment.amount || 0),
        payment_method: payment.payment_method,
        reference_number: payment.reference_number ?? "",
        remarks: payment.remarks ?? "",
      }));

      const grabaRows = ((grabaPayments.data ?? []) as unknown as GrabaPaymentRecord[]).map((payment) => ({
        id: `graba-${payment.id}`,
        source: "GRABA",
        document_number: grabaDr(payment.graba_records),
        account_name: grabaSupplier(payment.graba_records),
        payment_date: payment.payment_date,
        amount: Number(payment.amount || 0),
        payment_method: payment.payment_method,
        reference_number: payment.reference_number ?? "",
        remarks: payment.remarks ?? "",
      }));

      setRows([...saleRows, ...grabaRows]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load payments.");
    } finally {
      setLoading(false);
    }
  }

  async function savePayment() {
    const target = targets.find((item) => item.id === form.target_id && item.type === form.target_type);
    if (!target || !form.payment_date || !form.amount || !form.payment_method) {
      setError("Payment Source, Date, Amount, and Method are required.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const amount = Number(form.amount || 0);
      const paymentRecord = {
        payment_date: form.payment_date,
        amount,
        payment_method: form.payment_method,
        reference_number: form.reference_number.trim() || null,
        remarks: form.remarks.trim() || null,
      };

      if (target.type === "sales") {
        const { error: insertError } = await supabase.from("sales_payments").insert({
          sales_record_id: target.id,
          ...paymentRecord,
        });
        if (insertError) throw new Error(insertError.message);

        const status = target.paid_amount + amount >= target.total_amount ? "paid" : "deposit";
        const { error: statusError } = await supabase
          .from("sales_records")
          .update({ payment_status: status })
          .eq("id", target.id);
        if (statusError) throw new Error(statusError.message);
      } else {
        const { error: insertError } = await supabase.from("graba_payments").insert({
          graba_record_id: target.id,
          ...paymentRecord,
        });
        if (insertError) throw new Error(insertError.message);

        const status = target.paid_amount + amount >= target.total_amount ? "paid" : "deposit";
        const { error: statusError } = await supabase
          .from("graba_records")
          .update({ payment_status: status })
          .eq("id", target.id);
        if (statusError) throw new Error(statusError.message);
      }

      setMessage("Payment saved.");
      setForm(emptyForm);
      await loadRows();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save payment.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRows();
  }, []);

  return (
    <Stack gap='md'>
      <Paper
        withBorder
        radius='sm'
        p='md'
        className='masterPanel'
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void savePayment();
          }}
        >
          <Stack gap='md'>
            <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }}>
              <SuggestionTextInput
                label='Payment Source'
                suggestions={targets.map((target) => target.label)}
                value={form.target_label}
                onValueChange={(value) => {
                  const target = targets.find((item) => item.label === value);
                  setForm((current) => ({
                    ...current,
                    target_label: value,
                    target_id: target?.id ?? null,
                    target_type: target?.type ?? null,
                  }));
                }}
                onCommit={(value) => {
                  const target = targets.find((item) => item.label === value);
                  setForm((current) => ({
                    ...current,
                    target_label: value,
                    target_id: target?.id ?? null,
                    target_type: target?.type ?? null,
                  }));
                }}
                submitOnEnter={() => setTimeout(() => void savePayment(), 0)}
              />
              <TextInput
                label='Date'
                type='date'
                value={form.payment_date}
                onChange={(event) => setForm((current) => ({ ...current, payment_date: event.currentTarget.value }))}
              />
              <NumberInput
                label='Amount'
                min={0}
                value={form.amount}
                onChange={(value) => setForm((current) => ({ ...current, amount: Number(value) || "" }))}
              />
              <SuggestionTextInput
                label='Method'
                suggestions={["cash", "bank transfer", "check", "gcash"]}
                value={form.payment_method}
                onValueChange={(value) => setForm((current) => ({ ...current, payment_method: value }))}
                submitOnEnter={() => setTimeout(() => void savePayment(), 0)}
              />
              <TextInput
                label='Reference'
                value={form.reference_number}
                onChange={(event) => setForm((current) => ({ ...current, reference_number: event.currentTarget.value }))}
              />
              <TextInput
                label='Remarks'
                value={form.remarks}
                onChange={(event) => setForm((current) => ({ ...current, remarks: event.currentTarget.value }))}
              />
            </SimpleGrid>

            <Group>
              <Button
                leftSection={<Save size={16} />}
                type='submit'
                loading={loading}
              >
                Save Payment
              </Button>
              <Button
                leftSection={<RefreshCw size={16} />}
                variant='light'
                onClick={loadRows}
                loading={loading}
              >
                Refresh
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>

      {!isSupabaseConfigured && (
        <Alert
          icon={<AlertCircle size={16} />}
          color='yellow'
          title='Supabase is not configured'
        >
          Supabase credentials are missing from .env.
        </Alert>
      )}

      {error && (
        <Alert
          icon={<AlertCircle size={16} />}
          color='red'
          title='Database error'
        >
          {error}
        </Alert>
      )}

      {message && <Alert color='green'>{message}</Alert>}

      <CustomExcelTable
        columns={columns}
        data={rows}
      />
    </Stack>
  );
}
