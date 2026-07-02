import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  TextInput,
} from "@mantine/core";
import { AlertCircle, RefreshCw, Save } from "lucide-react";
import {
  CustomExcelTable,
  type ExcelColumn,
} from "../components/CustomExcelTable";
import { SuggestionTextInput } from "../components/SuggestionTextInput";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

type PaymentMethod = "CASH" | "CK" | "ONLINE" | "DEPOSIT";

type PayableSale = {
  id: string;
  sale_or_number: number;
  sale_date: string;
  customer_name: string;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
};

type PaymentDraft = {
  selected: boolean;
  amount: number | "";
};

type PaymentRow = {
  id: string;
  document_number: string;
  account_name: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number: string;
  remarks: string;
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

type SalesPerson = {
  id: string;
  label: string;
};

type PaymentForm = {
  payment_date: string;
  payment_method: PaymentMethod;
  sales_person: string;
  ck_number: string;
  counter_date: string;
  counter: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm: PaymentForm = {
  payment_date: today(),
  payment_method: "CASH",
  sales_person: "",
  ck_number: "",
  counter_date: "",
  counter: "",
};

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "CASH" },
  { value: "CK", label: "CK (Cheque)" },
  { value: "ONLINE", label: "ONLINE" },
  { value: "DEPOSIT", label: "DEPOSIT" },
];

const paymentColumns: ExcelColumn<PaymentRow>[] = [
  { key: "document_number", label: "OR", width: 120, sortable: true },
  { key: "account_name", label: "Client", width: 220, sortable: true },
  {
    key: "payment_date",
    label: "Date",
    type: "date",
    width: 120,
    sortable: true,
  },
  {
    key: "amount",
    label: "Amount",
    type: "number",
    width: 140,
    sortable: true,
  },
  { key: "payment_method", label: "Method", width: 130, sortable: true },
  { key: "reference_number", label: "Reference", width: 160, sortable: true },
  { key: "remarks", label: "Remarks", width: 260 },
];

const salesCustomer = (value: SalesPaymentRecord["sales_records"]) => {
  const record = Array.isArray(value) ? value[0] : value;
  const customer = Array.isArray(record?.customers)
    ? record?.customers[0]?.name
    : record?.customers?.name;
  return customer ?? record?.manual_customer_name ?? "";
};

const salesOr = (value: SalesPaymentRecord["sales_records"]) => {
  const record = Array.isArray(value) ? value[0] : value;
  return `OR ${record?.sale_or_number ?? ""}`;
};

const money = (value: number) =>
  `₱${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function PaymentsPage() {
  const [payableSales, setPayableSales] = useState<PayableSale[]>([]);
  const [paymentDrafts, setPaymentDrafts] = useState<
    Record<string, PaymentDraft>
  >({});
  const [salesPeople, setSalesPeople] = useState<SalesPerson[]>([]);
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [form, setForm] = useState<PaymentForm>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedDrafts = useMemo(
    () =>
      payableSales
        .map((sale) => ({ sale, draft: paymentDrafts[sale.id] }))
        .filter(({ draft }) => draft?.selected),
    [payableSales, paymentDrafts],
  );

  const selectedTotal = selectedDrafts.reduce(
    (sum, { draft }) => sum + Number(draft.amount || 0),
    0,
  );

  async function loadRows() {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const [salesSummary, salesPayments, salesPeopleResult] =
        await Promise.all([
          supabase
            .from("sales_billing_summary")
            .select(
              "id,sale_or_number,sale_date,customer_name,total_amount,paid_amount,balance_amount",
            )
            .gt("balance_amount", 0)
            .order("sale_or_number", { ascending: false }),
          supabase
            .from("sales_payments")
            .select(
              "id,payment_date,amount,payment_method,reference_number,remarks,sales_records(sale_or_number,manual_customer_name,customers(name))",
            )
            .order("payment_date", { ascending: false })
            .limit(300),
          supabase.from("sales_people").select("id,name").order("name"),
        ]);

      const firstError =
        salesSummary.error ?? salesPayments.error ?? salesPeopleResult.error;
      if (firstError) throw new Error(firstError.message);

      const sales = ((salesSummary.data ?? []) as unknown as PayableSale[]).map(
        (sale) => ({
          id: sale.id,
          sale_or_number: Number(sale.sale_or_number || 0),
          sale_date: sale.sale_date,
          customer_name: sale.customer_name ?? "No client",
          total_amount: Number(sale.total_amount || 0),
          paid_amount: Number(sale.paid_amount || 0),
          balance_amount: Number(sale.balance_amount || 0),
        }),
      );
      setPayableSales(sales);
      setPaymentDrafts((current) => {
        const nextDrafts: Record<string, PaymentDraft> = {};
        for (const sale of sales) {
          nextDrafts[sale.id] = current[sale.id] ?? {
            selected: false,
            amount: sale.balance_amount,
          };
        }
        return nextDrafts;
      });

      setSalesPeople(
        ((salesPeopleResult.data ?? []) as { id: string; name: string }[]).map(
          (person) => ({
            id: person.id,
            label: person.name,
          }),
        ),
      );

      setRows(
        ((salesPayments.data ?? []) as unknown as SalesPaymentRecord[]).map(
          (payment) => ({
            id: payment.id,
            document_number: salesOr(payment.sales_records),
            account_name: salesCustomer(payment.sales_records),
            payment_date: payment.payment_date,
            amount: Number(payment.amount || 0),
            payment_method: payment.payment_method,
            reference_number: payment.reference_number ?? "",
            remarks: payment.remarks ?? "",
          }),
        ),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load payments.",
      );
    } finally {
      setLoading(false);
    }
  }

  function updateDraft(saleId: string, patch: Partial<PaymentDraft>) {
    const previous = paymentDrafts[saleId] ?? { selected: false, amount: "" };
    setPaymentDrafts((current) => ({
      ...current,
      [saleId]: { ...previous, ...patch },
    }));
  }

  function buildRemarks() {
    const parts = [`Sales: ${form.sales_person.trim()}`];
    if (form.payment_method === "CK" && form.counter_date) {
      parts.push(`Counter Date: ${form.counter_date}`);
    }
    if (form.payment_method === "DEPOSIT" && form.counter.trim()) {
      parts.push(`Counter: ${form.counter.trim()}`);
    }
    return parts.join(" | ");
  }

  async function savePayments() {
    if (!isSupabaseConfigured) {
      setError("Supabase credentials are missing from .env.");
      return;
    }

    if (
      !form.payment_date ||
      !form.payment_method ||
      !form.sales_person.trim()
    ) {
      setError("Payment Date, Method, and Sales are required.");
      return;
    }

    if (form.payment_method === "CK" && !form.ck_number.trim()) {
      setError("CK No is required for CK payments.");
      return;
    }

    if (selectedDrafts.length === 0) {
      setError("Select at least one OR to pay.");
      return;
    }

    for (const { sale, draft } of selectedDrafts) {
      const amount = Number(draft.amount || 0);
      if (amount <= 0) {
        setError(`OR ${sale.sale_or_number}: Amount must be greater than 0.`);
        return;
      }
      if (amount > sale.balance_amount) {
        setError(`OR ${sale.sale_or_number}: Amount cannot exceed balance.`);
        return;
      }
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const remarks = buildRemarks();
      const payload = selectedDrafts.map(({ sale, draft }) => ({
        sales_record_id: sale.id,
        payment_date: form.payment_date,
        amount: Number(draft.amount || 0),
        payment_method: form.payment_method,
        reference_number:
          form.payment_method === "CK" ? form.ck_number.trim() : null,
        remarks,
      }));

      const { error: insertError } = await supabase
        .from("sales_payments")
        .insert(payload);
      if (insertError) throw new Error(insertError.message);

      await Promise.all(
        selectedDrafts.map(({ sale, draft }) => {
          const nextPaidAmount = sale.paid_amount + Number(draft.amount || 0);
          const status =
            nextPaidAmount >= sale.total_amount ? "paid" : "deposit";
          return supabase
            .from("sales_records")
            .update({ payment_status: status })
            .eq("id", sale.id);
        }),
      );

      setMessage(
        `Saved ${payload.length} payment${payload.length === 1 ? "" : "s"}.`,
      );
      setForm(emptyForm);
      await loadRows();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save payment.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRows();
  }, []);

  return (
    <Stack gap="md">
      <Paper withBorder radius="sm" p="md" className="masterPanel">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void savePayments();
          }}
        >
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
              <Select
                label="Payment Method"
                data={paymentMethods}
                value={form.payment_method}
                allowDeselect={false}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    payment_method: (value ?? "CASH") as PaymentMethod,
                    ck_number: value === "CK" ? current.ck_number : "",
                    counter_date: value === "CK" ? current.counter_date : "",
                    counter: value === "DEPOSIT" ? current.counter : "",
                  }))
                }
              />
              <TextInput
                label="Payment Date"
                type="date"
                value={form.payment_date}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    payment_date: event.currentTarget.value,
                  }))
                }
              />
              <SuggestionTextInput
                label="Sales"
                value={form.sales_person}
                suggestions={salesPeople.map((person) => person.label)}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, sales_person: value }))
                }
                onCommit={(value) =>
                  setForm((current) => ({ ...current, sales_person: value }))
                }
                submitOnEnter={() => setTimeout(() => void savePayments(), 0)}
              />
              {form.payment_method === "CK" && (
                <TextInput
                  label="CK No"
                  value={form.ck_number}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      ck_number: event.currentTarget.value,
                    }))
                  }
                />
              )}
              {form.payment_method === "CK" && (
                <TextInput
                  label="Counter Date"
                  type="date"
                  value={form.counter_date}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      counter_date: event.currentTarget.value,
                    }))
                  }
                />
              )}
              {form.payment_method === "DEPOSIT" && (
                <TextInput
                  label="Counter"
                  value={form.counter}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      counter: event.currentTarget.value,
                    }))
                  }
                />
              )}
            </SimpleGrid>

            <Group justify="space-between">
              <Group>
                <Button
                  leftSection={<Save size={16} />}
                  type="submit"
                  loading={loading}
                >
                  Save Payments
                </Button>
                <Button
                  type="button"
                  leftSection={<RefreshCw size={16} />}
                  variant="light"
                  onClick={loadRows}
                  loading={loading}
                >
                  Refresh
                </Button>
              </Group>
              <Badge variant="light">
                Selected: {selectedDrafts.length} | Amount:{" "}
                {money(selectedTotal)}
              </Badge>
            </Group>
          </Stack>
        </form>
      </Paper>

      <Paper withBorder radius="sm" p="md" className="masterPanel">
        <Stack gap="sm">
          <Group justify="space-between">
            <Badge variant="outline">Payable Sales</Badge>
            <Badge variant="light">{payableSales.length} open ORs</Badge>
          </Group>
          <ScrollArea type="auto">
            <Table miw={980} verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Pay</Table.Th>
                  <Table.Th>OR</Table.Th>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Client</Table.Th>
                  <Table.Th>Total</Table.Th>
                  <Table.Th>Paid</Table.Th>
                  <Table.Th>Balance</Table.Th>
                  <Table.Th>Amount</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {payableSales.map((sale) => {
                  const draft = paymentDrafts[sale.id] ?? {
                    selected: false,
                    amount: sale.balance_amount,
                  };

                  return (
                    <Table.Tr key={sale.id}>
                      <Table.Td>
                        <Checkbox
                          checked={draft.selected}
                          onChange={(event) =>
                            updateDraft(sale.id, {
                              selected: event.currentTarget.checked,
                            })
                          }
                        />
                      </Table.Td>
                      <Table.Td>OR {sale.sale_or_number}</Table.Td>
                      <Table.Td>{sale.sale_date}</Table.Td>
                      <Table.Td>{sale.customer_name}</Table.Td>
                      <Table.Td>{money(sale.total_amount)}</Table.Td>
                      <Table.Td>{money(sale.paid_amount)}</Table.Td>
                      <Table.Td>{money(sale.balance_amount)}</Table.Td>
                      <Table.Td>
                        <NumberInput
                          w={140}
                          min={0}
                          max={sale.balance_amount}
                          value={draft.amount}
                          onChange={(value) =>
                            updateDraft(sale.id, {
                              amount: Number(value) || "",
                              selected:
                                draft.selected || Number(value || 0) > 0,
                            })
                          }
                        />
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
                {!payableSales.length && (
                  <Table.Tr>
                    <Table.Td colSpan={8}>No payable sales to display</Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Stack>
      </Paper>

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

      {message && <Alert color="green">{message}</Alert>}

      <CustomExcelTable columns={paymentColumns} data={rows} />
    </Stack>
  );
}
