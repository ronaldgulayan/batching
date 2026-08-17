import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  LoadingOverlay,
  Modal,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  TextInput,
  Text,
} from "@mantine/core";
import { AlertCircle, RefreshCw, Save, Trash2, Edit3, X, CreditCard } from "lucide-react";
import { CustomExcelTable, type ExcelColumn } from "../components/CustomExcelTable";
import { SuggestionTextInput } from "../components/SuggestionTextInput";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { DateShortcutInput } from "../components/DateShortcutInput";
import { useSnackbar } from "../context/SnackbarContext";

type SupplierRow = {
  id: string;
  dr_number: string;
  transaction_date: string;
  supplier_name: string;
  item_name: string;
  qty: number;
  price: number;
  total_amount: number;
  payment_status: string;
  ck_number: string;
  amount: number | null;
  date: string;
  remarks: string;
  po_number: string;
};

type SupplierRecord = {
  id: string;
  dr_number: string | null;
  transaction_date: string;
  supplier_name: string | null;
  item_name: string | null;
  qty: number;
  price: number;
  total_amount: number;
  payment_status: string;
  supplier_payments?: {
    ck_number: string | null;
    amount: number;
    payment_date: string;
    remarks: string | null;
    po_number: string | null;
  } | {
    ck_number: string | null;
    amount: number;
    payment_date: string;
    remarks: string | null;
    po_number: string | null;
  }[] | null;
};

type SupplierForm = {
  transaction_date: string;
  dr_number: string;
  supplier_name: string;
  item_name: string;
  qty: number | "";
  price: number | "";
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm: SupplierForm = {
  transaction_date: today(),
  dr_number: "",
  supplier_name: "",
  item_name: "",
  qty: "",
  price: "",
};

const columns: ExcelColumn<SupplierRow>[] = [
  { key: "dr_number", label: "DR", type: "text", width: 80, sortable: true },
  { key: "transaction_date", label: "Date", type: "date", width: 110, sortable: true },
  { key: "supplier_name", label: "Supplier", width: 180, sortable: true },
  { key: "item_name", label: "Item", width: 140, sortable: true },
  { key: "qty", label: "Qty", type: "number", width: 80 },
  { key: "price", label: "Price", type: "number", width: 110, sortable: true },
  { key: "total_amount", label: "Total", type: "number", width: 125, sortable: true },
  { key: "ck_number", label: "CK Number", width: 110 },
  { key: "amount", label: "Amount", type: "number", width: 115 },
  { key: "date", label: "Payment Date", type: "date", width: 110 },
  { key: "remarks", label: "Remarks", width: 110 },
  { key: "po_number", label: "PO No", width: 110 },
  { key: "payment_status", label: "Status", width: 110, sortable: true },
];

export function SupplierTransactionsPage() {
  const { showSuccess, showError } = useSnackbar();
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [suppliersOptions, setSuppliersOptions] = useState<string[]>([]);
  const [itemsOptions, setItemsOptions] = useState<string[]>([]);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Single Pay Modal State
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payingTransaction, setPayingTransaction] = useState<SupplierRow | null>(null);
  const [payForm, setPayForm] = useState({
    payment_date: new Date().toISOString().slice(0, 10),
    ck_number: "",
    po_number: "",
    remarks: "Paid",
    amount: 0,
  });

  const total = useMemo(
    () => Number(form.qty || 0) * Number(form.price || 0),
    [form.qty, form.price]
  );

  const filteredRows = useMemo(() => {
    return rows;
  }, [rows]);

  async function loadLookups() {
    const [suppliersRes, itemsRes] = await Promise.all([
      supabase.from("suppliers").select("name").order("name"),
      supabase.from("supplier_items").select("item").order("item"),
    ]);

    if (suppliersRes.error) throw new Error(suppliersRes.error.message);

    setSuppliersOptions((suppliersRes.data ?? []).map((s) => s.name));
    setItemsOptions((itemsRes.data ?? []).map((i) => i.item));
  }

  async function loadRows() {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await loadLookups();
      const { data, error: loadError } = await supabase
        .from("supplier_transactions")
        .select("id,dr_number,transaction_date,supplier_name,item_name,qty,price,total_amount,payment_status,supplier_payments(payment_date,amount,ck_number,po_number,remarks)")
        .order("dr_number", { ascending: false })
        .limit(300);

      if (loadError) throw new Error(loadError.message);

      const records = (data ?? []) as any[];
      setRows(
        records.map((r) => {
          const paymentsList = Array.isArray(r.supplier_payments)
            ? r.supplier_payments
            : r.supplier_payments
            ? [r.supplier_payments]
            : [];
          const payment = paymentsList[0];

          return {
            id: r.id,
            dr_number: r.dr_number ? String(r.dr_number) : "",
            transaction_date: r.transaction_date,
            supplier_name: r.supplier_name ?? "",
            item_name: r.item_name ?? "",
            qty: Number(r.qty || 0),
            price: Number(r.price || 0),
            total_amount: Number(r.total_amount || 0),
            payment_status: r.payment_status,
            ck_number: payment?.ck_number ?? "",
            amount: payment?.amount !== undefined && payment?.amount !== null ? Number(payment.amount) : null,
            date: payment?.payment_date ?? "",
            remarks: payment?.remarks ?? "",
            po_number: payment?.po_number ?? "",
          };
        })
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load Supplier transactions.");
    } finally {
      setLoading(false);
    }
  }

  async function saveTransaction() {
    if (!isSupabaseConfigured) {
      setError("Supabase credentials are missing.");
      return;
    }

    const drNumber = form.dr_number.trim();

    if (!form.transaction_date || !drNumber || !form.supplier_name.trim() || !form.item_name.trim() || !form.qty || !form.price) {
      setError("Date, DR, Supplier Name, Item, Qty, and Price are required.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        dr_number: drNumber,
        transaction_date: form.transaction_date,
        supplier_name: form.supplier_name.trim(),
        item_name: form.item_name.trim(),
        qty: Number(form.qty || 0),
        price: Number(form.price || 0),
        total_amount: total,
      };

      let query;
      if (editingId) {
        query = supabase.from("supplier_transactions").update(payload).eq("id", editingId);
      } else {
        query = supabase.from("supplier_transactions").insert({
          ...payload,
          payment_status: "unpaid",
        });
      }

      const { error: saveError } = await query;
      if (saveError) throw new Error(saveError.message);

      const successMsg = editingId ? `Updated DR ${drNumber}.` : `Saved DR ${drNumber}.`;
      setMessage(successMsg);
      showSuccess(successMsg);
      setEditingId(null);
      
      setForm(emptyForm);
      await loadRows();
    } catch (saveError) {
      const errTxt = saveError instanceof Error ? saveError.message : "Unable to save transaction.";
      setError(errTxt);
      showError(errTxt);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(row: SupplierRow) {
    setEditingId(row.id);
    setForm({
      transaction_date: row.transaction_date,
      dr_number: row.dr_number,
      supplier_name: row.supplier_name,
      item_name: row.item_name,
      qty: row.qty,
      price: row.price,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function deleteTransaction(row: SupplierRow) {
    if (!window.confirm("Are you sure you want to delete this record? This will perform a hard delete.")) {
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");

    const { error: deleteError } = await supabase
      .from("supplier_transactions")
      .delete()
      .eq("id", row.id);

    setLoading(false);

    if (deleteError) {
      setError(deleteError.message);
      showError(deleteError.message);
      return;
    }

    const delMsg = "Record deleted successfully.";
    setMessage(delMsg);
    showSuccess(delMsg);
    if (editingId === row.id) {
      cancelEdit();
    }
    await loadRows();
  }

  function handlePayTransaction(row: SupplierRow) {
    if (row.payment_status === "paid") {
      showError(`DR ${row.dr_number} is already fully paid.`);
      return;
    }
    const balance = row.total_amount - (row.amount || 0);
    setPayingTransaction(row);
    setPayForm({
      payment_date: new Date().toISOString().slice(0, 10),
      ck_number: "",
      po_number: row.po_number || "",
      remarks: "Paid",
      amount: balance > 0 ? balance : row.total_amount,
    });
    setPayModalOpen(true);
  }

  async function submitSupplierPayment() {
    if (!payingTransaction) return;
    if (Number(payForm.amount) <= 0) {
      showError("Payment amount must be greater than 0.");
      return;
    }

    setLoading(true);
    try {
      const { error: insertErr } = await supabase.from("supplier_payments").insert({
        supplier_transaction_id: payingTransaction.id,
        payment_date: payForm.payment_date,
        amount: Number(payForm.amount),
        ck_number: payForm.ck_number.trim() || null,
        po_number: payForm.po_number.trim() || null,
        remarks: payForm.remarks.trim() || null,
      });

      if (insertErr) throw new Error(insertErr.message);

      const nextPaidAmount = (payingTransaction.amount || 0) + Number(payForm.amount);
      const nextStatus = nextPaidAmount >= payingTransaction.total_amount ? "paid" : "deposit";

      const { error: updateErr } = await supabase
        .from("supplier_transactions")
        .update({ payment_status: nextStatus })
        .eq("id", payingTransaction.id);

      if (updateErr) throw new Error(updateErr.message);

      const msg = `Payment of ₱${Number(payForm.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} for Supplier DR ${payingTransaction.dr_number} saved successfully.`;
      showSuccess(msg);
      setPayModalOpen(false);
      setPayingTransaction(null);
      await loadRows();
    } catch (err: any) {
      showError(err.message || "Failed to record payment.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRows();
  }, []);

  return (
    <Stack gap="md">
      <LoadingOverlay
        visible={loading}
        zIndex={1000}
        transitionProps={{ duration: 0 }}
        overlayProps={{ opacity: 0.35, blur: 0.5 }}
        loaderProps={{ color: "blue", type: "bars", size: "lg" }}
        style={{ position: "fixed", inset: 0 }}
      />
      <Paper withBorder p="md" className="masterPanel">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void saveTransaction();
          }}
        >
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
              <DateShortcutInput
                label="Date"
                value={form.transaction_date}
                onChange={(val) => setForm((current) => ({ ...current, transaction_date: val }))}
              />
              <TextInput
                label="DR"
                placeholder="DR reference no."
                required
                value={form.dr_number}
                onChange={(event) => setForm((current) => ({ ...current, dr_number: event.currentTarget.value }))}
              />
              <SuggestionTextInput
                label="Supplier Name"
                value={form.supplier_name}
                suggestions={suppliersOptions}
                onValueChange={(value) => setForm((current) => ({ ...current, supplier_name: value }))}
              />
              <SuggestionTextInput
                label="Item"
                value={form.item_name}
                suggestions={itemsOptions}
                onValueChange={(value) => setForm((current) => ({ ...current, item_name: value }))}
              />
              <NumberInput
                label="Qty"
                min={0}
                value={form.qty}
                onChange={(value) => setForm((current) => ({ ...current, qty: Number(value) || "" }))}
              />
              <NumberInput
                label="Price"
                min={0}
                value={form.price}
                onChange={(value) => setForm((current) => ({ ...current, price: Number(value) || "" }))}
              />
              <NumberInput
                label="Total"
                value={total}
                readOnly
                thousandSeparator=","
                decimalScale={2}
              />
            </SimpleGrid>

            <Group justify="space-between">
              <Group>
                <Button leftSection={<Save size={16} />} type="submit" loading={loading}>
                  {editingId ? "Update Transaction" : "Save Transaction"}
                </Button>
                {editingId && (
                  <Button leftSection={<X size={16} />} variant="light" color="gray" onClick={cancelEdit}>
                    Cancel Edit
                  </Button>
                )}
                <Button leftSection={<RefreshCw size={16} />} variant="light" onClick={loadRows} loading={loading}>
                  Refresh
                </Button>
              </Group>
            </Group>
          </Stack>
        </form>
      </Paper>

      {!isSupabaseConfigured && (
        <Alert icon={<AlertCircle size={16} />} color="yellow" title="Supabase is not configured">
          Supabase credentials are missing from .env.
        </Alert>
      )}

      {error && (
        <Alert icon={<AlertCircle size={16} />} color="red" title="Database error">
          {error}
        </Alert>
      )}

      {message && <Alert color="green">{message}</Alert>}

      <CustomExcelTable
        columns={columns}
        data={rows}
        onPayClick={(row) => handlePayTransaction(row)}
        onEditClick={(row) => startEdit(row)}
        onDeleteClick={(row) => deleteTransaction(row)}
        contextMenuItems={["pay", "edit", "delete"]}
        renderRowActions={(row) => (
          <Group gap="xs" justify="center">
            <Button size="xs" variant="subtle" leftSection={<Edit3 size={14} />} onClick={() => startEdit(row)}>
              Edit
            </Button>
            <Button size="xs" variant="subtle" color="red" leftSection={<Trash2 size={14} />} onClick={() => deleteTransaction(row)}>
              Delete
            </Button>
          </Group>
        )}
        renderCell={(row, column) => {
          if (column.key !== "payment_status") return undefined;
          const isPaid = row.payment_status === "paid";
          const isDeposit = row.payment_status === "deposit";
          return (
            <Badge color={isPaid ? "green" : isDeposit ? "yellow" : "red"} variant="light">
              {row.payment_status}
            </Badge>
          );
        }}
      />

      {/* Pay Single Supplier Transaction Modal */}
      <Modal
        opened={payModalOpen}
        onClose={() => {
          setPayModalOpen(false);
          setPayingTransaction(null);
        }}
        title={
          <Group gap="xs">
            <CreditCard size={18} color="#10b981" />
            <Text fw={700} size="md">
              Pay Supplier DR {payingTransaction?.dr_number}
            </Text>
          </Group>
        }
        size="md"
        centered
      >
        {payingTransaction && (
          <Stack gap="md">
            <Paper p="sm" radius="xs" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <SimpleGrid cols={2} spacing="xs">
                <div>
                  <Text size="xs" c="dimmed">Supplier</Text>
                  <Text size="sm" fw={600}>{payingTransaction.supplier_name}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Date</Text>
                  <Text size="sm">{payingTransaction.transaction_date}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Item & Qty</Text>
                  <Text size="sm">{payingTransaction.item_name} ({payingTransaction.qty} @ ₱{payingTransaction.price})</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Total Amount</Text>
                  <Text size="sm" fw={700} c="teal.4">₱{payingTransaction.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                </div>
              </SimpleGrid>
            </Paper>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <DateShortcutInput
                label="Payment Date"
                value={payForm.payment_date}
                onChange={(val) => setPayForm((p) => ({ ...p, payment_date: val }))}
              />
              <TextInput
                label="CK Number (Optional)"
                placeholder="Check number..."
                value={payForm.ck_number}
                onChange={(e) => setPayForm((p) => ({ ...p, ck_number: e.currentTarget.value }))}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <TextInput
                label="PO Number (Optional)"
                placeholder="PO number..."
                value={payForm.po_number}
                onChange={(e) => setPayForm((p) => ({ ...p, po_number: e.currentTarget.value }))}
              />
              <NumberInput
                label="Amount to Pay"
                value={payForm.amount}
                onChange={(val) => setPayForm((p) => ({ ...p, amount: Number(val || 0) }))}
                min={0}
                decimalScale={2}
                thousandSeparator=","
                prefix="₱ "
                required
              />
            </SimpleGrid>

            <TextInput
              label="Remarks"
              placeholder="e.g. Paid, Partial, Cash..."
              value={payForm.remarks}
              onChange={(e) => setPayForm((p) => ({ ...p, remarks: e.currentTarget.value }))}
            />

            <Group justify="flex-end" mt="md">
              <Button
                variant="light"
                color="gray"
                onClick={() => {
                  setPayModalOpen(false);
                  setPayingTransaction(null);
                }}
              >
                Cancel
              </Button>
              <Button
                color="teal"
                leftSection={<CreditCard size={16} />}
                onClick={submitSupplierPayment}
                loading={loading}
              >
                Confirm Payment
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
