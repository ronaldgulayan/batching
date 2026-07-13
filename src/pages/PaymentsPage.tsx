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
import { AlertCircle, Edit3, RefreshCw, Save, Trash2 } from "lucide-react";
import { SuggestionTextInput } from "../components/SuggestionTextInput";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { CustomExcelTable, type ExcelColumn } from "../components/CustomExcelTable";
import { DateShortcutInput } from "../components/DateShortcutInput";

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
  sales_person: string;
  term: string;
};

type PaymentDraft = {
  selected: boolean;
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
  edit_amount: number | "";
  total_amount_paid: number | "";
  term: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm: PaymentForm = {
  payment_date: today(),
  payment_method: "CASH",
  sales_person: "",
  ck_number: "",
  edit_amount: "",
  total_amount_paid: "",
  term: "",
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

  const selectedBalanceTotal = useMemo(
    () =>
      selectedDrafts.reduce(
        (sum, { sale }) => sum + sale.balance_amount,
        0,
      ),
    [selectedDrafts],
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

  const unpaidColumns = useMemo<ExcelColumn<PayableSale>[]>(
    () => [
      { key: "sale_or_number", label: "OR", type: "number" },
      { key: "sale_date", label: "Date", type: "date" },
      { key: "customer_name", label: "Client", type: "text" },
      { key: "total_amount", label: "Total", type: "number" },
      { key: "paid_amount", label: "Paid", type: "number" },
      { key: "balance_amount", label: "Balance", type: "number" },
    ],
    [],
  );

  const selectedUnpaidRowIds = useMemo(() => {
    const ids = new Set<string | number>();
    for (const [id, draft] of Object.entries(paymentDrafts)) {
      if (draft.selected) {
        ids.add(id);
      }
    }
    return ids;
  }, [paymentDrafts]);

  const handleUnpaidSelectionChange = (newSelectedIds: Set<string | number>) => {
    setPaymentDrafts((current) => {
      const next = { ...current };
      payableSales.forEach((sale) => {
        const isSelected = newSelectedIds.has(sale.id);
        next[sale.id] = {
          ...next[sale.id],
          selected: isSelected,
        };
      });
      return next;
    });

    const newTotal = payableSales
      .filter((sale) => newSelectedIds.has(sale.id))
      .reduce((sum, sale) => sum + sale.balance_amount, 0);

    setForm((current) => ({
      ...current,
      total_amount_paid: newTotal > 0 ? newTotal : "",
    }));
  };

  const renderUnpaidCell = (row: PayableSale, column: ExcelColumn<PayableSale>) => {
    if (column.key === "sale_or_number") {
      return `OR ${row.sale_or_number}`;
    }
    return undefined;
  };

  const paidColumns = useMemo<ExcelColumn<PaidSale>[]>(
    () => [
      { key: "sale_or_number", label: "OR", type: "number" },
      { key: "sale_date", label: "Date", type: "date" },
      { key: "customer_name", label: "Client", type: "text" },
      { key: "total_amount", label: "Total", type: "number" },
      { key: "paid_amount", label: "Paid", type: "number" },
      { key: "balance_amount", label: "Balance", type: "number" },
      { key: "payment_date", label: "Payment Date", type: "date" },
      { key: "payment_amount", label: "Amount", type: "number" },
      { key: "payment_method", label: "Method", type: "text" },
      { key: "ck_number", label: "CK No", type: "text" },
      { key: "sales_person", label: "Sales", type: "text" },
      { key: "term", label: "Term", type: "text" },
    ],
    [],
  );

  const renderPaidCell = (row: PaidSale, column: ExcelColumn<PaidSale>) => {
    if (column.key === "sale_or_number") {
      return `OR ${row.sale_or_number}`;
    }
    if (column.key === "payment_amount") {
      return row.payment_amount ? displayMoney(row.payment_amount) : "";
    }
    return undefined;
  };


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
            sales_person: remarkValue(payment?.remarks ?? null, "Sales"),
            term: remarkValue(payment?.remarks ?? null, "Term"),
          };
        }),
      );
      setPaymentDrafts((current) => {
        const nextDrafts: Record<string, PaymentDraft> = {};
        for (const sale of openSales) {
          nextDrafts[sale.id] = current[sale.id] ?? {
            selected: false,
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
      edit_amount: sale.payment_amount || "",
      total_amount_paid: "",
      term: sale.term || "",
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

  async function deletePayment(sale: PaidSale) {
    if (!sale.payment_id) return;
    if (!window.confirm('Are you sure you want to delete this payment? This will mark the sale back as unpaid.')) {
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");

    const { error: deleteError } = await supabase
      .from("sales_payments")
      .delete()
      .eq("id", sale.payment_id);

    setLoading(false);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setMessage("Payment deleted successfully.");
    if (editingPayment?.paymentId === sale.payment_id) {
      cancelEditPayment();
    }
    await loadRows();
  }

  function buildRemarks(termOverride?: string) {
    const parts = [];
    const salesPerson = form.sales_person.trim();
    if (salesPerson) parts.push(`Sales: ${salesPerson}`);
    
    const term = termOverride !== undefined ? termOverride : form.term.trim();
    if (term) parts.push(`Term: ${term}`);
    
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

    if (!editingPayment && Number(form.total_amount_paid || 0) <= 0) {
      setError("Total Amount Paid must be greater than 0.");
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

      // Distribute total paid amount among selected sales
      let remainingPaid = Number(form.total_amount_paid || 0);
      const paymentPayload = [];
      const saleUpdates = [];

      for (let i = 0; i < selectedDrafts.length; i++) {
        const { sale } = selectedDrafts[i];
        
        let paymentForThisSale = 0;
        
        if (i === selectedDrafts.length - 1) {
          // The last selected sale gets all the remaining paid amount, 
          // including any overpayment (sobra).
          paymentForThisSale = remainingPaid;
        } else {
          // Pay up to the balance amount of this sale
          paymentForThisSale = Math.min(remainingPaid, sale.balance_amount);
          if (paymentForThisSale < 0) {
            paymentForThisSale = 0;
          }
        }
        
        remainingPaid -= paymentForThisSale;

        if (paymentForThisSale > 0) {
          paymentPayload.push({
            sales_record_id: sale.id,
            payment_date: form.payment_date,
            amount: paymentForThisSale,
            payment_method: form.payment_method,
            reference_number:
              form.payment_method === "CK" ? form.ck_number.trim() : null,
            remarks,
          });

          const nextPaidAmount = sale.paid_amount + paymentForThisSale;
          const status = nextPaidAmount >= sale.total_amount ? "paid" : "deposit";
          saleUpdates.push({
            id: sale.id,
            status,
          });
        }
      }

      if (paymentPayload.length > 0) {
        const { error: insertError } = await supabase
          .from("sales_payments")
          .insert(paymentPayload);
        if (insertError) throw new Error(insertError.message);

        await Promise.all(
          saleUpdates.map(({ id, status }) =>
            supabase
              .from("sales_records")
              .update({ payment_status: status })
              .eq("id", id),
          ),
        );
      }

      setMessage(
        `Saved ${paymentPayload.length} payment${paymentPayload.length === 1 ? "" : "s"}.`,
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
                  }));
                }}
              />
              <DateShortcutInput
                label='Payment Date'
                value={form.payment_date}
                error={paymentDateError}
                onChange={(val) => {
                  setPaymentDateError("");
                  setForm((current) => ({
                    ...current,
                    payment_date: val,
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
              <TextInput
                label='Term'
                placeholder='Optional description'
                value={form.term}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    term: event.currentTarget.value,
                  }))
                }
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
              {!editingPayment && (
                <Stack gap={4}>
                  <NumberInput
                    label="Total Amount Paid"
                    min={0}
                    value={form.total_amount_paid}
                    onChange={(value) => {
                      setForm((current) => ({
                        ...current,
                        total_amount_paid: Number(value) || "",
                      }));
                    }}
                  />
                  {selectedBalanceTotal > 0 &&
                    form.total_amount_paid !== "" &&
                    Number(form.total_amount_paid) !== selectedBalanceTotal && (
                      <Group gap="xs" style={{ marginTop: 2 }}>
                        {Number(form.total_amount_paid) - selectedBalanceTotal < 0 ? (
                          <Badge color="red" variant="filled">
                            Kulang ng {formatMoney(Math.abs(Number(form.total_amount_paid) - selectedBalanceTotal))}
                          </Badge>
                        ) : (
                          <Badge color="green" variant="filled">
                            Sobra ng {formatMoney(Number(form.total_amount_paid) - selectedBalanceTotal)}
                          </Badge>
                        )}
                      </Group>
                    )}
                </Stack>
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
                  : `Selected: ${selectedDrafts.length} | Balance Total: ${displayMoney(selectedBalanceTotal)}`}
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
          <CustomExcelTable
            columns={unpaidColumns}
            data={filteredPayableSales}
            withSelection={true}
            checkedRowIds={selectedUnpaidRowIds}
            onCheckedRowIdsChange={handleUnpaidSelectionChange}
            renderCell={renderUnpaidCell}
            contextMenuItems={["select_rows"]}
            onSelectRowsClick={(selectedRows) => {
              const nextSelected = new Set(selectedUnpaidRowIds);
              selectedRows.forEach((row) => nextSelected.add(row.id));
              handleUnpaidSelectionChange(nextSelected);
            }}
          />
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
          <CustomExcelTable
            columns={paidColumns}
            data={filteredPaidSales}
            renderCell={renderPaidCell}
            onEditClick={(row) => {
              if (row.payment_id) {
                startEditPayment(row);
              }
            }}
            onDeleteClick={(row) => {
              if (row.payment_id) {
                void deletePayment(row);
              }
            }}
            renderRowActions={(row) => (
              <Group gap='xs' justify='center'>
                <Button
                  size='xs'
                  variant='subtle'
                  leftSection={<Edit3 size={14} />}
                  onClick={() => startEditPayment(row)}
                  disabled={!row.payment_id}
                >
                  Edit
                </Button>
                <Button
                  size='xs'
                  variant='subtle'
                  color='red'
                  leftSection={<Trash2 size={14} />}
                  onClick={() => void deletePayment(row)}
                  disabled={!row.payment_id}
                >
                  Delete
                </Button>
              </Group>
            )}
          />
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
