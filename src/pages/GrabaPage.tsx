import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Group,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  TextInput,
  Text,
} from "@mantine/core";
import { AlertCircle, RefreshCw, Save, Trash2, Edit3, X } from "lucide-react";
import { CustomExcelTable, type ExcelColumn } from "../components/CustomExcelTable";
import { SuggestionTextInput } from "../components/SuggestionTextInput";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { DateShortcutInput } from "../components/DateShortcutInput";

type Lookup = {
  id: string;
  label: string;
};

type GrabaRow = {
  id: string;
  graba_dr_number: string;
  graba_date: string;
  supplier_name: string;
  items: string;
  truck: string;
  length_value: number;
  width_value: number;
  height_value: number;
  cubic_volume: number;
  unit_price: number;
  total_amount: number;
  remarks: string;
  payment_status: string;
  check_no: string;
  amount: number | null;
  date: string;
};

type GrabaRecord = {
  id: string;
  graba_dr_number: string | null;
  graba_date: string;
  supplier_id: string | null;
  manual_supplier_name: string | null;
  items: string | null;
  truck: string | null;
  length_value: number;
  width_value: number;
  height_value: number;
  cubic_volume: number;
  unit_price: number;
  total_amount: number;
  payment_status: string;
  suppliers?: { name: string } | { name: string }[] | null;
  graba_payments?: {
    payment_method: string;
    reference_number: string | null;
    amount: number;
    payment_date: string;
  } | {
    payment_method: string;
    reference_number: string | null;
    amount: number;
    payment_date: string;
  }[] | null;
};

type GrabaForm = {
  graba_date: string;
  graba_dr_number: string;
  supplier_name: string;
  items: string;
  truck: string;
  length_value: number | "";
  width_value: number | "";
  height_value: number | "";
  unit_price: number | "";
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm: GrabaForm = {
  graba_date: today(),
  graba_dr_number: "",
  supplier_name: "",
  items: "",
  truck: "",
  length_value: "",
  width_value: "",
  height_value: "",
  unit_price: "",
};

const columns: ExcelColumn<GrabaRow>[] = [
  { key: "graba_dr_number", label: "DR", type: "text", width: 80, sortable: true },
  { key: "graba_date", label: "Date", type: "date", width: 110, sortable: true },
  { key: "supplier_name", label: "Supplier", width: 180, sortable: true },
  { key: "items", label: "Items", width: 140, sortable: true },
  { key: "truck", label: "Truck", width: 110, sortable: true },
  { key: "length_value", label: "L", type: "number", width: 70 },
  { key: "width_value", label: "W", type: "number", width: 70 },
  { key: "height_value", label: "H", type: "number", width: 70 },
  { key: "cubic_volume", label: "Cubic", type: "number", width: 100, sortable: true },
  { key: "unit_price", label: "Price", type: "number", width: 110, sortable: true },
  { key: "total_amount", label: "Total", type: "number", width: 125, sortable: true },
  { key: "remarks", label: "Remarks", width: 130 },
  { key: "payment_status", label: "Payment", width: 110, sortable: true },
  { key: "check_no", label: "Check No", width: 110 },
  { key: "amount", label: "Amount", type: "number", width: 115 },
  { key: "date", label: "Check Date", type: "date", width: 110 },
];

const relatedSupplier = (value: GrabaRecord["suppliers"]) =>
  Array.isArray(value) ? value[0]?.name : value?.name;

export function GrabaPage() {
  const [rows, setRows] = useState<GrabaRow[]>([]);
  const [suppliers, setSuppliers] = useState<Lookup[]>([]);
  const [itemsOptions, setItemsOptions] = useState<{ item: string; price: number }[]>([]);
  const [trucksOptions, setTrucksOptions] = useState<string[]>([]);
  const [form, setForm] = useState<GrabaForm>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const cubic = useMemo(
    () =>
      Number(form.length_value || 0) *
      Number(form.width_value || 0) *
      Number(form.height_value || 0),
    [form.height_value, form.length_value, form.width_value],
  );
  const total = useMemo(() => cubic * Number(form.unit_price || 0), [cubic, form.unit_price]);

  async function loadLookups() {
    const [suppliersRes, itemsRes, trucksRes] = await Promise.all([
      supabase.from("suppliers").select("id,name").order("name"),
      supabase.from("graba_items").select("item,price").order("item"),
      supabase.from("graba_trucks").select("truck").order("truck"),
    ]);

    if (suppliersRes.error) throw new Error(suppliersRes.error.message);
    
    setSuppliers((suppliersRes.data ?? []).map((s) => ({ id: s.id, label: s.name })));
    setItemsOptions((itemsRes.data ?? []).map((i) => ({ item: i.item, price: Number(i.price || 0) })));
    setTrucksOptions((trucksRes.data ?? []).map((t) => t.truck));
  }

  async function loadRows() {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await loadLookups();
      const { data, error: loadError } = await supabase
        .from("graba_records")
        .select(
          "id,graba_dr_number,graba_date,supplier_id,manual_supplier_name,items,truck,length_value,width_value,height_value,cubic_volume,unit_price,total_amount,payment_status,suppliers(name),graba_payments(payment_method,reference_number,amount,payment_date)",
        )
        .order("graba_dr_number", { ascending: false })
        .limit(300);

      if (loadError) throw new Error(loadError.message);

      const records = (data ?? []) as unknown as GrabaRecord[];
      setRows(
        records.map((record) => {
          const paymentsList = Array.isArray(record.graba_payments)
            ? record.graba_payments
            : record.graba_payments
            ? [record.graba_payments]
            : [];
          const payment = paymentsList[0];
          const method = payment?.payment_method ?? "";

          let automaticRemarks = "Unpaid";
          if (record.payment_status === "paid" || record.payment_status === "deposit") {
            if (method.toUpperCase() === "CASH") {
              automaticRemarks = "Counter";
            } else if (method.toUpperCase() === "CK") {
              automaticRemarks = "Paid";
            } else {
              automaticRemarks = record.payment_status;
            }
          }

          return {
            id: record.id,
            graba_dr_number: record.graba_dr_number ? String(record.graba_dr_number) : "",
            graba_date: record.graba_date,
            supplier_name: relatedSupplier(record.suppliers) ?? record.manual_supplier_name ?? "",
            items: record.items ?? "",
            truck: record.truck ?? "",
            length_value: Number(record.length_value || 0),
            width_value: Number(record.width_value || 0),
            height_value: Number(record.height_value || 0),
            cubic_volume: Number(record.cubic_volume || 0),
            unit_price: Number(record.unit_price || 0),
            total_amount: Number(record.total_amount || 0),
            remarks: automaticRemarks,
            payment_status: record.payment_status,
            check_no: payment?.reference_number ?? "",
            amount: payment?.amount !== undefined && payment?.amount !== null ? Number(payment.amount) : null,
            date: payment?.payment_date ?? "",
          };
        }),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load GRABA.");
    } finally {
      setLoading(false);
    }
  }

  async function ensureSupplierId(supplierName: string) {
    const cleaned = supplierName.trim();
    if (!cleaned) return null;

    const existing = suppliers.find((supplier) => supplier.label.toLowerCase() === cleaned.toLowerCase());
    if (existing) return existing.id;

    const { data, error: insertError } = await supabase
      .from("suppliers")
      .insert({ name: cleaned })
      .select("id,name")
      .single();
    if (insertError) throw new Error(insertError.message);

    setSuppliers((current) => [...current, { id: data.id, label: data.name }]);
    return data.id;
  }

  async function saveGraba() {
    if (!isSupabaseConfigured) {
      setError("Supabase credentials are missing from .env.");
      return;
    }

    const drNumber = form.graba_dr_number.trim();

    if (!form.graba_date || !drNumber || !form.supplier_name.trim() || !form.items.trim()) {
      setError("Date, DR, Supplier Name, and Items are required.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const supplierId = await ensureSupplierId(form.supplier_name);
      if (!supplierId) throw new Error("Supplier Name is required.");

      const payload = {
        graba_dr_number: drNumber,
        graba_date: form.graba_date,
        supplier_id: supplierId,
        manual_supplier_name: null,
        items: form.items.trim(),
        truck: form.truck.trim() || null,
        length_value: Number(form.length_value || 0),
        width_value: Number(form.width_value || 0),
        height_value: Number(form.height_value || 0),
        unit_price: Number(form.unit_price || 0),
      };

      let query;
      if (editingId) {
        query = supabase.from("graba_records").update(payload).eq("id", editingId);
      } else {
        query = supabase.from("graba_records").insert({
          ...payload,
          payment_status: "unpaid",
        });
      }

      const { error: saveError } = await query;
      if (saveError) throw new Error(saveError.message);

      setMessage(editingId ? `Updated GRABA DR ${drNumber}.` : `Saved GRABA DR ${drNumber}.`);
      setEditingId(null);
      
      setForm(emptyForm);
      await loadRows();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save GRABA.");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(row: GrabaRow) {
    setEditingId(row.id);
    setForm({
      graba_date: row.graba_date,
      graba_dr_number: row.graba_dr_number,
      supplier_name: row.supplier_name,
      items: row.items,
      truck: row.truck,
      length_value: row.length_value || "",
      width_value: row.width_value || "",
      height_value: row.height_value || "",
      unit_price: row.unit_price || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function deleteGraba(row: GrabaRow) {
    if (!window.confirm("Are you sure you want to delete this GRABA record? This will perform a hard delete.")) {
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");

    const { error: deleteError } = await supabase
      .from("graba_records")
      .delete()
      .eq("id", row.id);

    setLoading(false);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setMessage("GRABA record deleted successfully.");
    if (editingId === row.id) {
      cancelEdit();
    }
    await loadRows();
  }

  useEffect(() => {
    void loadRows();
  }, []);

  const handleItemChange = (value: string) => {
    setForm((current) => {
      const matched = itemsOptions.find((i) => i.item.toLowerCase() === value.trim().toLowerCase());
      return {
        ...current,
        items: value,
        unit_price: matched ? matched.price : current.unit_price,
      };
    });
  };

  return (
    <Stack gap="md">
      <Paper
        withBorder
        p="md"
        className="masterPanel"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void saveGraba();
          }}
        >
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
              <DateShortcutInput
                label="Date"
                value={form.graba_date}
                onChange={(val) => setForm((current) => ({ ...current, graba_date: val }))}
              />
              <TextInput
                label="DR"
                placeholder="DR reference no."
                required
                value={form.graba_dr_number}
                onChange={(event) => setForm((current) => ({ ...current, graba_dr_number: event.currentTarget.value }))}
              />
              <SuggestionTextInput
                label="Supplier Name"
                value={form.supplier_name}
                suggestions={suppliers.map((supplier) => supplier.label)}
                onValueChange={(value) => setForm((current) => ({ ...current, supplier_name: value }))}
              />
              <SuggestionTextInput
                label="Items"
                value={form.items}
                suggestions={itemsOptions.map((i) => i.item)}
                onValueChange={handleItemChange}
                onCommit={handleItemChange}
              />
              <SuggestionTextInput
                label="Truck"
                value={form.truck}
                suggestions={trucksOptions}
                onValueChange={(value) => setForm((current) => ({ ...current, truck: value }))}
              />
              
              {/* L, W, H side by side, taking up only 1 grid cell */}
              <Stack gap={2}>
                <Text size="sm" fw={500}>Dimensions (L × W × H)</Text>
                <SimpleGrid cols={3} spacing="xs">
                  <NumberInput
                    placeholder="L"
                    min={0}
                    value={form.length_value}
                    onChange={(value) => setForm((current) => ({ ...current, length_value: Number(value) || "" }))}
                  />
                  <NumberInput
                    placeholder="W"
                    min={0}
                    value={form.width_value}
                    onChange={(value) => setForm((current) => ({ ...current, width_value: Number(value) || "" }))}
                  />
                  <NumberInput
                    placeholder="H"
                    min={0}
                    value={form.height_value}
                    onChange={(value) => setForm((current) => ({ ...current, height_value: Number(value) || "" }))}
                  />
                </SimpleGrid>
              </Stack>

              <NumberInput
                label="Cubic"
                value={cubic}
                readOnly
                thousandSeparator=","
                decimalScale={2}
              />
              <NumberInput
                label="Price"
                min={0}
                value={form.unit_price}
                onChange={(value) => setForm((current) => ({ ...current, unit_price: Number(value) || "" }))}
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
                <Button
                  leftSection={<Save size={16} />}
                  type="submit"
                  loading={loading}
                >
                  {editingId ? "Update GRABA" : "Save GRABA"}
                </Button>
                {editingId && (
                  <Button
                    leftSection={<X size={16} />}
                    variant="light"
                    color="gray"
                    onClick={cancelEdit}
                  >
                    Cancel Edit
                  </Button>
                )}
                <Button
                  leftSection={<RefreshCw size={16} />}
                  variant="light"
                  onClick={loadRows}
                  loading={loading}
                >
                  Refresh
                </Button>
              </Group>
            </Group>
          </Stack>
        </form>
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

      <CustomExcelTable
        columns={columns}
        data={rows}
        onEditClick={(row) => startEdit(row)}
        onDeleteClick={(row) => deleteGraba(row)}
        renderRowActions={(row) => (
          <Group gap="xs" justify="center">
            <Button
              size="xs"
              variant="subtle"
              leftSection={<Edit3 size={14} />}
              onClick={() => startEdit(row)}
            >
              Edit
            </Button>
            <Button
              size="xs"
              variant="subtle"
              color="red"
              leftSection={<Trash2 size={14} />}
              onClick={() => deleteGraba(row)}
            >
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
    </Stack>
  );
}
