import { useEffect, useMemo, useRef, useState } from "react";
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
import { AlertCircle, Edit3, RefreshCw, Save } from "lucide-react";
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

type PaidSale = PayableSale & {
  payment_id: string;
  payment_date: string;
  payment_amount: number;
  payment_method: string;
  ck_number: string;
  counter_date: string;
  counter: string;
  sales_person: string;
};

type PaymentDraft = {
  selected: boolean;
  amount: number | "";
};

type SalesPaymentRecord = {
  id: string;
  sales_record_id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  remarks: string | null;
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
  edit_amount: number | "";
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm: PaymentForm = {
  payment_date: today(),
  payment_method: "CASH",
  sales_person: "",
  ck_number: "",
  counter_date: "",
  counter: "",
  edit_amount: "",
};

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "CASH" },
  { value: "CK", label: "CK (Cheque)" },
  { value: "ONLINE", label: "ONLINE" },
  { value: "DEPOSIT", label: "DEPOSIT" },
];

const displayMoney = (value: number) =>
  `PHP ${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatMoney = (value: number) =>
  `₱${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function remarkValue(remarks: string | null, label: string) {
  return (
    remarks
      ?.split("|")
      .map((part) => part.trim())
      .find((part) => part.toLowerCase().startsWith(`${label.toLowerCase()}:`))
      ?.slice(label.length + 1)
      .trim() ?? ""
  );
}

export function PaymentsPage() {
  const formPanelRef = useRef<HTMLDivElement | null>(null);
  const [payableSales, setPayableSales] = useState<PayableSale[]>([]);
  const [paidSales, setPaidSales] = useState<PaidSale[]>([]);
  const [paymentDrafts, setPaymentDrafts] = useState<
    Record<string, PaymentDraft>
  >({});
  const [salesPeople, setSalesPeople] = useState<SalesPerson[]>([]);
  const [form, setForm] = useState<PaymentForm>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paymentDateError, setPaymentDateError] = useState("");
  const [salesFieldError, setSalesFieldError] = useState("");
  const [ckNumberError, setCkNumberError] = useState("");
  const [editAmountError, setEditAmountError] = useState("");
  const [amountErrors, setAmountErrors] = useState<Record<string, string>>({});
  const [editingPayment, setEditingPayment] = useState<{
    paymentId: string;
    saleId: string;
    oldAmount: number;
    totalAmount: number;
    paidAmount: number;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [unpaidSearch, setUnpaidSearch] = useState("");
  const [paidSearch, setPaidSearch] = useState("");

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

  function saleMatchesSearch(sale: PayableSale, searchValue: string) {
    const cleaned = searchValue.trim().toLowerCase();
    if (!cleaned) return true;
    const paidDetail = sale as Partial<PaidSale>;

    return [
      `OR ${sale.sale_or_number}`,
      sale.sale_or_number,
      sale.sale_date,
      sale.customer_name,
      sale.total_amount,
      sale.paid_amount,
      sale.balance_amount,
      displayMoney(sale.total_amount),
      displayMoney(sale.paid_amount),
      displayMoney(sale.balance_amount),
      paidDetail.payment_date ?? "",
      paidDetail.payment_amount ?? "",
      paidDetail.payment_amount ? displayMoney(paidDetail.payment_amount) : "",
      paidDetail.payment_method ?? "",
      paidDetail.ck_number ?? "",
      paidDetail.counter_date ?? "",
      paidDetail.counter ?? "",
      paidDetail.sales_person ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(cleaned);
  }

  const filteredPayableSales = useMemo(
    () => payableSales.filter((sale) => saleMatchesSearch(sale, unpaidSearch)),
    [payableSales, unpaidSearch],
  );

  const filteredPaidSales = useMemo(
    () => paidSales.filter((sale) => saleMatchesSearch(sale, paidSearch)),
    [paidSales, paidSearch],
  );

  async function loadRows() {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError("");
    setPaymentDateError("");
    setSalesFieldError("");
    setCkNumberError("");
    setEditAmountError("");
    setAmountErrors({});
    setMessage("");

    try {
      const [salesSummary, salesPaymentsResult, salesPeopleResult] =
        await Promise.all([
          supabase
            .from("sales_billing_summary")
            .select(
              "id,sale_or_number,sale_date,customer_name,total_amount,paid_amount,balance_amount",
            )
            .order("sale_or_number", { ascending: false }),
          supabase
            .from("sales_payments")
            .select(
              "id,sales_record_id,payment_date,amount,payment_method,reference_number,remarks",
            )
            .order("payment_date", { ascending: false }),
          supabase.from("sales_people").select("id,name").order("name"),
        ]);

      const firstError =
        salesSummary.error ??
        salesPaymentsResult.error ??
        salesPeopleResult.error;
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
      const openSales = sales.filter((sale) => sale.balance_amount > 0);
      const closedSales = sales.filter((sale) => sale.balance_amount <= 0);
      const latestPaymentBySaleId = new Map<string, SalesPaymentRecord>();
      for (const payment of (salesPaymentsResult.data ??
        []) as unknown as SalesPaymentRecord[]) {
        if (!latestPaymentBySaleId.has(payment.sales_record_id)) {
          latestPaymentBySaleId.set(payment.sales_record_id, payment);
        }
      }

      setPayableSales(openSales);
      setPaidSales(
        closedSales.map((sale) => {
          const payment = latestPaymentBySaleId.get(sale.id);
          const method = payment?.payment_method ?? "";

          return {
            ...sale,
            payment_id: payment?.id ?? "",
            payment_date: payment?.payment_date ?? "",
            payment_amount: Number(payment?.amount || 0),
            payment_method: method,
            ck_number: method === "CK" ? (payment?.reference_number ?? "") : "",
            counter_date:
              method === "CK"
                ? remarkValue(payment?.remarks ?? null, "Counter Date")
                : "",
            counter:
              method === "DEPOSIT"
                ? remarkValue(payment?.remarks ?? null, "Counter")
                : "",
            sales_person: remarkValue(payment?.remarks ?? null, "Sales"),
          };
        }),
      );
      setPaymentDrafts((current) => {
        const nextDrafts: Record<string, PaymentDraft> = {};
        for (const sale of openSales) {
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
    setPaymentDrafts((current) => ({
      ...current,
      [saleId]: {
        ...(current[saleId] ?? { selected: false, amount: "" }),
        ...patch,
      },
    }));
  }

  function toggleDraft(sale: PayableSale) {
    if (editingPayment) return;

    const draft = paymentDrafts[sale.id] ?? {
      selected: false,
      amount: sale.balance_amount,
    };

    updateDraft(sale.id, {
      selected: !draft.selected,
      amount: draft.amount || sale.balance_amount,
    });
  }

  function startEditPayment(sale: PaidSale) {
    if (!sale.payment_id) return;

    setEditingPayment({
      paymentId: sale.payment_id,
      saleId: sale.id,
      oldAmount: sale.payment_amount,
      totalAmount: sale.total_amount,
      paidAmount: sale.paid_amount,
    });
    setError("");
    setMessage("");
    setPaymentDateError("");
    setSalesFieldError("");
    setCkNumberError("");
    setEditAmountError("");
    setForm({
      payment_date: sale.payment_date || today(),
      payment_method: (sale.payment_method || "CASH") as PaymentMethod,
      sales_person: sale.sales_person,
      ck_number: sale.ck_number,
      counter_date: sale.counter_date,
      counter: sale.counter,
      edit_amount: sale.payment_amount || "",
    });
    requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    });
  }

  function cancelEditPayment() {
    setEditingPayment(null);
    setError("");
    setMessage("");
    setPaymentDateError("");
    setSalesFieldError("");
    setCkNumberError("");
    setEditAmountError("");
    setForm(emptyForm);
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

    setError("");
    setPaymentDateError("");
    setSalesFieldError("");
    setCkNumberError("");
    setEditAmountError("");
    setAmountErrors({});

    let hasFieldError = false;

    if (!form.payment_date) {
      setPaymentDateError("Payment Date is required.");
      hasFieldError = true;
    }

    if (!form.sales_person.trim()) {
      setSalesFieldError("Sales is required.");
      hasFieldError = true;
    }

    if (form.payment_method === "CK" && !form.ck_number.trim()) {
      setCkNumberError("CK No is required.");
      hasFieldError = true;
    }

    if (editingPayment && Number(form.edit_amount || 0) <= 0) {
      setEditAmountError("Amount is required.");
      hasFieldError = true;
    }

    if (hasFieldError) {
      return;
    }

    if (!editingPayment && selectedDrafts.length === 0) {
      setError("Select at least one OR to pay.");
      return;
    }

    const nextAmountErrors: Record<string, string> = {};
    if (!editingPayment) {
      for (const { sale, draft } of selectedDrafts) {
        const amount = Number(draft.amount || 0);
        if (amount <= 0) {
          nextAmountErrors[sale.id] = "Amount is required.";
        }
        if (amount > sale.balance_amount) {
          nextAmountErrors[sale.id] = "Cannot exceed balance.";
        }
      }
    }

    if (Object.keys(nextAmountErrors).length > 0) {
      setAmountErrors(nextAmountErrors);
      return;
    }

    setLoading(true);
    setError("");
    setSalesFieldError("");
    setMessage("");

    try {
      const remarks = buildRemarks();
      if (editingPayment) {
        const amount = Number(form.edit_amount || 0);
        const paymentRecord = {
          payment_date: form.payment_date,
          amount,
          payment_method: form.payment_method,
          reference_number:
            form.payment_method === "CK" ? form.ck_number.trim() : null,
          remarks,
        };

        const { error: updateError } = await supabase
          .from("sales_payments")
          .update(paymentRecord)
          .eq("id", editingPayment.paymentId);
        if (updateError) throw new Error(updateError.message);

        const nextPaidAmount =
          editingPayment.paidAmount - editingPayment.oldAmount + amount;
        const status =
          nextPaidAmount >= editingPayment.totalAmount ? "paid" : "deposit";
        const { error: statusError } = await supabase
          .from("sales_records")
          .update({ payment_status: status })
          .eq("id", editingPayment.saleId);
        if (statusError) throw new Error(statusError.message);

        setMessage("Payment updated.");
        setEditingPayment(null);
        setForm(emptyForm);
        await loadRows();
        return;
      }

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
      setEditingPayment(null);
      setPaymentDateError("");
      setSalesFieldError("");
      setCkNumberError("");
      setEditAmountError("");
      setAmountErrors({});
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
    <Stack gap='md'>
      <Paper
        ref={formPanelRef}
        withBorder
        radius='sm'
        p='md'
        className='masterPanel'
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void savePayments();
          }}
        >
          <Stack gap='md'>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
              <Select
                label='Payment Method'
                checkIconPosition='right'
                data={paymentMethods}
                value={form.payment_method}
                allowDeselect={false}
                onChange={(value) => {
                  setCkNumberError("");
                  setForm((current) => ({
                    ...current,
                    payment_method: (value ?? "CASH") as PaymentMethod,
                    ck_number: value === "CK" ? current.ck_number : "",
                    counter_date: value === "CK" ? current.counter_date : "",
                    counter: value === "DEPOSIT" ? current.counter : "",
                  }));
                }}
              />
              <TextInput
                label='Payment Date'
                type='date'
                value={form.payment_date}
                error={paymentDateError}
                onChange={(event) => {
                  setPaymentDateError("");
                  setForm((current) => ({
                    ...current,
                    payment_date: event.currentTarget.value,
                  }));
                }}
              />
              <SuggestionTextInput
                label='Sales'
                value={form.sales_person}
                error={salesFieldError}
                suggestions={salesPeople.map((person) => person.label)}
                onValueChange={(value) => {
                  setSalesFieldError("");
                  setForm((current) => ({ ...current, sales_person: value }));
                }}
                onCommit={(value) => {
                  setSalesFieldError("");
                  setForm((current) => ({ ...current, sales_person: value }));
                }}
                submitOnEnter={() => setTimeout(() => void savePayments(), 0)}
              />
              {form.payment_method === "CK" && (
                <TextInput
                  label='CK No'
                  value={form.ck_number}
                  error={ckNumberError}
                  onChange={(event) => {
                    setCkNumberError("");
                    setForm((current) => ({
                      ...current,
                      ck_number: event.currentTarget.value,
                    }));
                  }}
                />
              )}
              {form.payment_method === "CK" && (
                <TextInput
                  label='Counter Date'
                  type='date'
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
                  label='Counter'
                  value={form.counter}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      counter: event.currentTarget.value,
                    }))
                  }
                />
              )}
              {editingPayment && (
                <NumberInput
                  label='Amount'
                  min={0}
                  value={form.edit_amount}
                  error={editAmountError}
                  onChange={(value) => {
                    setEditAmountError("");
                    setForm((current) => ({
                      ...current,
                      edit_amount: Number(value) || "",
                    }));
                  }}
                />
              )}
            </SimpleGrid>

            <Group justify='space-between'>
              <Group>
                <Button
                  leftSection={<Save size={16} />}
                  type='submit'
                  loading={loading}
                >
                  {editingPayment ? "Save Changes" : "Save Payments"}
                </Button>
                {editingPayment && (
                  <Button
                    type='button'
                    variant='light'
                    color='gray'
                    onClick={cancelEditPayment}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type='button'
                  leftSection={<RefreshCw size={16} />}
                  variant='light'
                  onClick={loadRows}
                  loading={loading}
                >
                  Refresh
                </Button>
              </Group>
              <Badge variant='light'>
                {editingPayment
                  ? "Editing payment"
                  : `Selected: ${selectedDrafts.length} | Amount: ${displayMoney(selectedTotal)}`}
              </Badge>
            </Group>
          </Stack>
        </form>
      </Paper>

      <Paper
        withBorder
        radius='sm'
        p='md'
        className='masterPanel'
      >
        <Stack gap='sm'>
          <Group justify='space-between'>
            <Badge variant='outline'>Unpaid Sales</Badge>
            <Badge variant='light'>
              {filteredPayableSales.length} of {payableSales.length} open ORs
            </Badge>
          </Group>
          <TextInput
            placeholder='Search any unpaid sale'
            value={unpaidSearch}
            onChange={(event) => setUnpaidSearch(event.currentTarget.value)}
          />
          <ScrollArea type='auto'>
            <Table
              miw={980}
              verticalSpacing='xs'
            >
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
                {filteredPayableSales.map((sale) => {
                  const draft = paymentDrafts[sale.id] ?? {
                    selected: false,
                    amount: sale.balance_amount,
                  };

                  return (
                    <Table.Tr
                      key={sale.id}
                      onClick={() => toggleDraft(sale)}
                      style={{ cursor: "pointer" }}
                    >
                      <Table.Td>
                        <Checkbox
                          checked={draft.selected}
                          onClick={(event) => event.stopPropagation()}
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
                      <Table.Td>{displayMoney(sale.total_amount)}</Table.Td>
                      <Table.Td>{displayMoney(sale.paid_amount)}</Table.Td>
                      <Table.Td>{displayMoney(sale.balance_amount)}</Table.Td>
                      <Table.Td onClick={(event) => event.stopPropagation()}>
                        <NumberInput
                          w={140}
                          min={0}
                          max={sale.balance_amount}
                          value={draft.amount}
                          onChange={(value) => {
                            setAmountErrors((current) => {
                              const { [sale.id]: _removed, ...rest } = current;
                              return rest;
                            });
                            updateDraft(sale.id, {
                              amount: Number(value) || "",
                              selected:
                                draft.selected || Number(value || 0) > 0,
                            });
                          }}
                          error={amountErrors[sale.id]}
                        />
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
                {!filteredPayableSales.length && (
                  <Table.Tr>
                    <Table.Td colSpan={8}>No unpaid sales to display</Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Stack>
      </Paper>

      <Paper
        withBorder
        radius='sm'
        p='md'
        className='masterPanel'
      >
        <Stack gap='sm'>
          <Group justify='space-between'>
            <Badge variant='outline'>Paid Sales</Badge>
            <Badge variant='light'>
              {filteredPaidSales.length} of {paidSales.length} paid ORs
            </Badge>
          </Group>
          <TextInput
            placeholder='Search any paid sale'
            value={paidSearch}
            onChange={(event) => setPaidSearch(event.currentTarget.value)}
          />
          <ScrollArea type='auto'>
            <Table
              withColumnBorders
              miw={1320}
              verticalSpacing='xs'
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>OR</Table.Th>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Client</Table.Th>
                  <Table.Th>Total</Table.Th>
                  <Table.Th>Paid</Table.Th>
                  <Table.Th>Balance</Table.Th>
                  <Table.Th>Payment Date</Table.Th>
                  <Table.Th>Amount</Table.Th>
                  <Table.Th>Method</Table.Th>
                  <Table.Th>CK No</Table.Th>
                  <Table.Th>Counter Date</Table.Th>
                  <Table.Th>Counter</Table.Th>
                  <Table.Th>Sales</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredPaidSales.map((sale) => (
                  <Table.Tr key={sale.id}>
                    <Table.Td>OR {sale.sale_or_number}</Table.Td>
                    <Table.Td>{sale.sale_date}</Table.Td>
                    <Table.Td>{sale.customer_name}</Table.Td>
                    <Table.Td>{displayMoney(sale.total_amount)}</Table.Td>
                    <Table.Td>{displayMoney(sale.paid_amount)}</Table.Td>
                    <Table.Td>{displayMoney(sale.balance_amount)}</Table.Td>
                    <Table.Td>{sale.payment_date}</Table.Td>
                    <Table.Td>
                      {sale.payment_amount
                        ? displayMoney(sale.payment_amount)
                        : ""}
                    </Table.Td>
                    <Table.Td>{sale.payment_method}</Table.Td>
                    <Table.Td>{sale.ck_number}</Table.Td>
                    <Table.Td>{sale.counter_date}</Table.Td>
                    <Table.Td>{sale.counter}</Table.Td>
                    <Table.Td>{sale.sales_person}</Table.Td>
                    <Table.Td>
                      <Button
                        size='xs'
                        variant='subtle'
                        leftSection={<Edit3 size={14} />}
                        onClick={() => startEditPayment(sale)}
                        disabled={!sale.payment_id}
                      >
                        Edit
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {!filteredPaidSales.length && (
                  <Table.Tr>
                    <Table.Td colSpan={14}>No paid sales to display</Table.Td>
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
    </Stack>
  );
}
