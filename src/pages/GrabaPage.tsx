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
} from "@mantine/core";
import { AlertCircle, RefreshCw, Save, Trash2 } from "lucide-react";
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
  graba_dr_number: number;
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
};

type GrabaRecord = {
  id: string;
  graba_dr_number: number | null;
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
  remarks: string | null;
  payment_status: string;
  suppliers?: { name: string } | { name: string }[] | null;
};

type GrabaForm = {
  graba_date: string;
  graba_dr_number: number | "";
  supplier_name: string;
  items: string;
  truck: string;
  length_value: number | "";
  width_value: number | "";
  height_value: number | "";
  unit_price: number | "";
  remarks: string;
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
  remarks: "",
};

const columns: ExcelColumn<GrabaRow>[] = [
  { key: "graba_dr_number", label: "DR", type: "number", width: 100, sortable: true },
  { key: "graba_date", label: "Date", type: "date", width: 120, sortable: true },
  { key: "supplier_name", label: "Supplier", width: 220, sortable: true },
  { key: "items", label: "Items", width: 180, sortable: true },
  { key: "truck", label: "Truck", width: 140, sortable: true },
  { key: "length_value", label: "L", type: "number", width: 90 },
  { key: "width_value", label: "W", type: "number", width: 90 },
  { key: "height_value", label: "H", type: "number", width: 90 },
  { key: "cubic_volume", label: "Cubic", type: "number", width: 110, sortable: true },
  { key: "unit_price", label: "Price", type: "number", width: 120, sortable: true },
  { key: "total_amount", label: "Total", type: "number", width: 130, sortable: true },
  { key: "remarks", label: "Remarks", width: 220 },
  { key: "payment_status", label: "Payment", width: 120, sortable: true },
];

const relatedSupplier = (value: GrabaRecord["suppliers"]) =>
  Array.isArray(value) ? value[0]?.name : value?.name;

export function GrabaPage() {
  const [rows, setRows] = useState<GrabaRow[]>([]);
  const [suppliers, setSuppliers] = useState<Lookup[]>([]);
  const [form, setForm] = useState<GrabaForm>(emptyForm);
  const [nextDrNumber, setNextDrNumber] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const cubic = useMemo(
    () =>
      Number(form.length_value || 0) *
      Number(form.width_value || 0) *
      Number(form.height_value || 0),
    [form.height_value, form.length_value, form.width_value],
  );
  const total = useMemo(() => cubic * Number(form.unit_price || 0), [cubic, form.unit_price]);

  async function loadSuppliers() {
    const { data, error: supplierError } = await supabase.from("suppliers").select("id,name").order("name");
    if (supplierError) throw new Error(supplierError.message);
    setSuppliers((data ?? []).map((supplier) => ({ id: supplier.id, label: supplier.name })));
  }

  async function loadRows() {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await loadSuppliers();
      const { data, error: loadError } = await supabase
        .from("graba_records")
        .select(
          "id,graba_dr_number,graba_date,supplier_id,manual_supplier_name,items,truck,length_value,width_value,height_value,cubic_volume,unit_price,total_amount,remarks,payment_status,suppliers(name)",
        )
        .order("graba_dr_number", { ascending: false })
        .limit(300);

      if (loadError) throw new Error(loadError.message);

      const records = (data ?? []) as unknown as GrabaRecord[];
      const nextNumber =
        records.reduce((max, record) => Math.max(max, Number(record.graba_dr_number || 0)), 0) + 1;

      setNextDrNumber(nextNumber);
      setForm((current) => ({ ...current, graba_dr_number: current.graba_dr_number || nextNumber }));
      setRows(
        records.map((record) => ({
          id: record.id,
          graba_dr_number: Number(record.graba_dr_number || 0),
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
          remarks: record.remarks ?? "",
          payment_status: record.payment_status,
        })),
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

    const drNumber = Number(form.graba_dr_number || 0);
    if (drNumber < nextDrNumber) {
      setError(`DR must be ${nextDrNumber} or higher. Used or skipped numbers cannot be reused.`);
      return;
    }

    if (!form.graba_date || !form.supplier_name.trim() || !form.items.trim()) {
      setError("Date, DR, Supplier Name, and Items are required.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const supplierId = await ensureSupplierId(form.supplier_name);
      if (!supplierId) throw new Error("Supplier Name is required.");

      const { error: insertError } = await supabase.from("graba_records").insert({
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
        remarks: form.remarks.trim() || null,
        payment_status: "unpaid",
      });

      if (insertError) throw new Error(insertError.message);

      setMessage(`Saved GRABA DR ${drNumber}.`);
      setForm({ ...emptyForm, graba_dr_number: drNumber + 1 });
      await loadRows();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save GRABA.");
    } finally {
      setLoading(false);
    }
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
    await loadRows();
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
            void saveGraba();
          }}
        >
          <Stack gap='md'>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
              <DateShortcutInput
                label='Date'
                value={form.graba_date}
                onChange={(val) => setForm((current) => ({ ...current, graba_date: val }))}
              />
              <NumberInput
                label='DR'
                min={nextDrNumber}
                value={form.graba_dr_number}
                onChange={(value) => setForm((current) => ({ ...current, graba_dr_number: Number(value) || "" }))}
              />
              <SuggestionTextInput
                label='Supplier Name'
                value={form.supplier_name}
                suggestions={suppliers.map((supplier) => supplier.label)}
                onValueChange={(value) => setForm((current) => ({ ...current, supplier_name: value }))}
                submitOnEnter={() => setTimeout(() => void saveGraba(), 0)}
              />
              <TextInput
                label='Items'
                value={form.items}
                onChange={(event) => setForm((current) => ({ ...current, items: event.currentTarget.value }))}
              />
              <TextInput
                label='Truck'
                value={form.truck}
                onChange={(event) => setForm((current) => ({ ...current, truck: event.currentTarget.value }))}
              />
              <NumberInput
                label='L'
                min={0}
                value={form.length_value}
                onChange={(value) => setForm((current) => ({ ...current, length_value: Number(value) || "" }))}
              />
              <NumberInput
                label='W'
                min={0}
                value={form.width_value}
                onChange={(value) => setForm((current) => ({ ...current, width_value: Number(value) || "" }))}
              />
              <NumberInput
                label='H'
                min={0}
                value={form.height_value}
                onChange={(value) => setForm((current) => ({ ...current, height_value: Number(value) || "" }))}
              />
              <NumberInput
                label='Cubic'
                value={cubic}
                readOnly
                thousandSeparator=','
                decimalScale={2}
              />
              <NumberInput
                label='Price'
                min={0}
                value={form.unit_price}
                onChange={(value) => setForm((current) => ({ ...current, unit_price: Number(value) || "" }))}
              />
              <NumberInput
                label='Total'
                value={total}
                readOnly
                thousandSeparator=','
                decimalScale={2}
              />
              <TextInput
                label='Remarks'
                value={form.remarks}
                onChange={(event) => setForm((current) => ({ ...current, remarks: event.currentTarget.value }))}
              />
            </SimpleGrid>

            <Group justify='space-between'>
              <Group>
                <Button
                  leftSection={<Save size={16} />}
                  type='submit'
                  loading={loading}
                >
                  Save GRABA
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
              <Badge variant='light'>Next DR: {nextDrNumber}</Badge>
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
        onDeleteClick={(row) => deleteGraba(row)}
        renderRowActions={(row) => (
          <Button
            size="xs"
            variant="subtle"
            color="red"
            leftSection={<Trash2 size={14} />}
            onClick={() => deleteGraba(row)}
          >
            Delete
          </Button>
        )}
      />
    </Stack>
  );
}
