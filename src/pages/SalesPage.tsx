import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  TextInput,
} from "@mantine/core";
import {
  AlertCircle,
  CopyPlus,
  Edit3,
  RefreshCw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import {
  CustomExcelTable,
  type ExcelColumn,
} from "../components/CustomExcelTable";
import { SuggestionTextInput } from "../components/SuggestionTextInput";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { DateShortcutInput } from "../components/DateShortcutInput";

type Lookup = {
  id: string;
  label: string;
  pumpcreate?: number | null;
};

type SaleRow = {
  id: string;
  sale_or_number: number;
  sale_date: string;
  client_name: string;
  design: string;
  site: string;
  cubic_volume: number;
  unit_price: number;
  pumpcreate?: number | null;
  total_amount: number;
  payment_status: string;
  counter_date: string;
  counter: string;
};

type SalesRecord = {
  id: string;
  sale_or_number: number | null;
  sale_date: string;
  customer_id: string | null;
  manual_customer_name: string | null;
  project_site: string | null;
  cubic_volume: number;
  unit_price: number;
  pumpcreate?: number | null;
  total_amount: number;
  payment_status: string;
  remarks: string | null;
  customers?: { name: string } | { name: string }[] | null;
  concrete_designs?: { code: string; pumpcreate?: number | null } | { code: string; pumpcreate?: number | null }[] | null;
};

type SaleForm = {
  sale_date: string;
  sale_or_number: number | "";
  client_name: string;
  concrete_design_id: string | null;
  design_label: string;
  project_site: string;
  cubic_volume: number | "";
  unit_price: number | "";
  pumpcreate: number | "";
  counter_date: string;
  counter: string;
};

type BatchSaleDraft = SaleForm & {
  id: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm: SaleForm = {
  sale_date: today(),
  sale_or_number: "",
  client_name: "",
  concrete_design_id: null,
  design_label: "",
  project_site: "",
  cubic_volume: "",
  unit_price: "",
  pumpcreate: "",
  counter_date: "",
  counter: "",
};

const remarkValue = (remarks: string | null, label: string) =>
  remarks
    ?.split("|")
    .map((part) => part.trim())
    .find((part) => part.toLowerCase().startsWith(`${label.toLowerCase()}:`))
    ?.slice(label.length + 1)
    .trim() ?? "";

const buildRemarks = (counterDate: string, counter: string) => {
  const parts = [];
  if (counterDate) {
    parts.push(`Counter Date: ${counterDate}`);
  }
  if (counter.trim()) {
    parts.push(`Counter: ${counter.trim()}`);
  }
  return parts.join(" | ");
};

const relatedName = (value: SalesRecord["customers"]) =>
  Array.isArray(value) ? value[0]?.name : value?.name;

const relatedCode = (value: SalesRecord["concrete_designs"]) =>
  Array.isArray(value) ? value[0]?.code : value?.code;

const batchCountOptions = Array.from({ length: 9 }, (_, index) => {
  const value = String(index + 2);
  return { value, label: value };
});

const saleColumns: ExcelColumn<SaleRow>[] = [
  {
    key: "sale_or_number",
    label: "OR",
    type: "text",
    width: 90,
    sortable: true,
  },
  { key: "sale_date", label: "Date", type: "date", width: 100, sortable: true },
  { key: "client_name", label: "Client Name", width: 150, sortable: true },
  { key: "design", label: "Design", width: 140, sortable: true },
  { key: "site", label: "Site", width: 100, sortable: true },
  { key: "counter_date", label: "Counter Date", type: "date", width: 110, sortable: true },
  { key: "counter", label: "Counter", width: 100, sortable: true },
  {
    key: "cubic_volume",
    label: "Cubic",
    type: "number",
    width: 80,
    sortable: true,
  },
  {
    key: "unit_price",
    label: "Price",
    type: "number",
    width: 130,
    sortable: true,
  },
  {
    key: "pumpcreate",
    label: "Pumpcrete",
    type: "number",
    width: 110,
    sortable: true,
  },
  {
    key: "total_amount",
    label: "Total",
    type: "number",
    width: 140,
    sortable: true,
  },
  { key: "payment_status", label: "Payment", width: 120, sortable: true },
];

export function SalesPage() {
  const formPanelRef = useRef<HTMLDivElement | null>(null);
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [customers, setCustomers] = useState<Lookup[]>([]);
  const [designs, setDesigns] = useState<Lookup[]>([]);
  const [sites, setSites] = useState<Lookup[]>([]);
  const [form, setForm] = useState<SaleForm>(emptyForm);
  const [batchCount, setBatchCount] = useState("2");
  const [batchDrafts, setBatchDrafts] = useState<BatchSaleDraft[]>([]);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<{
    id: string;
    originalOrNumber: number;
  } | null>(null);
  const [selectedSaleIds, setSelectedSaleIds] = useState<Set<string | number>>(new Set());
  const [counterModalOpen, setCounterModalOpen] = useState(false);
  const [counterTargetRows, setCounterTargetRows] = useState<SaleRow[]>([]);
  const [counterDateValue, setCounterDateValue] = useState("");
  const [nextOrNumber, setNextOrNumber] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [salesSearch, setSalesSearch] = useState("");
  const hasBatchDrafts = batchDrafts.length > 0;

  const total = useMemo(
    () => Number(form.cubic_volume || 0) * Number(form.unit_price || 0),
    [form.cubic_volume, form.unit_price],
  );
  const displayedNextOrNumber = useMemo(() => {
    const formOrNumber = Number(form.sale_or_number || 0);
    const batchMaxOrNumber = batchDrafts.reduce(
      (max, draft) => Math.max(max, Number(draft.sale_or_number || 0)),
      0,
    );

    return Math.max(nextOrNumber, formOrNumber + 1, batchMaxOrNumber + 1);
  }, [batchDrafts, form.sale_or_number, nextOrNumber]);

  const filteredRows = useMemo(() => {
    const cleaned = salesSearch.trim().toLowerCase();
    if (!cleaned) return rows;

    return rows.filter((row) =>
      [
        `OR ${row.sale_or_number}`,
        row.sale_or_number,
        row.sale_date,
        row.client_name,
        row.design,
        row.site,
        row.cubic_volume,
        row.unit_price,
        row.pumpcreate,
        row.total_amount,
        row.payment_status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(cleaned),
    );
  }, [rows, salesSearch]);

  const handleCounterClick = (row: SaleRow, targetRows?: SaleRow[]) => {
    const targets = targetRows && targetRows.length > 0 ? targetRows : [row];
    setCounterTargetRows(targets);
    setCounterDateValue(row.counter_date || today());
    setCounterModalOpen(true);
  };

  async function saveCounterDateValue() {
    if (counterTargetRows.length === 0) return;
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await Promise.all(
        counterTargetRows.map(async (row) => {
          const nextRemarks = buildRemarks(counterDateValue, row.counter);
          const { error: updateError } = await supabase
            .from("sales_records")
            .update({ remarks: nextRemarks })
            .eq("id", row.id);
          if (updateError) throw new Error(updateError.message);
        })
      );

      setMessage(`Counter Date updated successfully for ${counterTargetRows.length} record(s).`);
      setCounterModalOpen(false);
      setCounterTargetRows([]);
      setSelectedSaleIds(new Set());
      await loadRows();
    } catch (saveErr) {
      setError(saveErr instanceof Error ? saveErr.message : "Unable to save counter date.");
    } finally {
      setLoading(false);
    }
  }

  async function loadLookups() {
    const [
      { data: customerData, error: customerError },
      { data: designData, error: designError },
      siteResult,
    ] = await Promise.all([
      supabase.from("customers").select("id,name").order("name"),
      supabase.from("concrete_designs").select("id,code,pumpcreate").order("code"),
      supabase.from("project_sites").select("id,name").order("name"),
    ]);

    if (customerError || designError || siteResult.error) {
      throw new Error(
        customerError?.message ||
          designError?.message ||
          siteResult.error?.message,
      );
    }

    setCustomers(
      (customerData ?? []).map((customer) => ({
        id: customer.id,
        label: customer.name,
      })),
    );
    setDesigns(
      (designData ?? []).map((design) => ({
        id: design.id,
        label: design.code,
        pumpcreate: (design.pumpcreate as number | null) ?? null,
      })),
    );
    setSites(
      (siteResult.data ?? []).map((site) => ({
        id: site.id,
        label: site.name,
      })),
    );
  }

  async function loadRows() {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await loadLookups();
      const { data, error: loadError } = await supabase
        .from("sales_records")
        .select(
          "id,sale_or_number,sale_date,customer_id,manual_customer_name,project_site,cubic_volume,unit_price,pumpcreate,total_amount,payment_status,customers(name),concrete_designs(code,pumpcreate),remarks",
        )
        .order("sale_or_number", { ascending: false })
        .limit(300);

      if (loadError) throw new Error(loadError.message);

      const records = (data ?? []) as unknown as SalesRecord[];
      const maxOrNumber = records.reduce(
        (max, record) => Math.max(max, Number(record.sale_or_number || 0)),
        0,
      );
      const nextNumber = maxOrNumber + 1;

      setNextOrNumber(nextNumber);
      setForm((current) => ({
        ...current,
        sale_or_number: current.sale_or_number || nextNumber,
      }));
      setRows(
        records.map((record) => {
          const designPumpcreate = Array.isArray(record.concrete_designs)
            ? record.concrete_designs[0]?.pumpcreate
            : record.concrete_designs?.pumpcreate;

          return {
            id: record.id,
            sale_or_number: Number(record.sale_or_number || 0),
            sale_date: record.sale_date,
            client_name:
              relatedName(record.customers) ?? record.manual_customer_name ?? "",
            design: relatedCode(record.concrete_designs) ?? "",
            site: record.project_site ?? "",
            cubic_volume: Number(record.cubic_volume || 0),
            unit_price: Number(record.unit_price || 0),
            pumpcreate: record.pumpcreate ?? designPumpcreate ?? null,
            total_amount: Number(record.total_amount || 0),
            payment_status: record.payment_status,
            counter_date: remarkValue(record.remarks, "Counter Date"),
            counter: remarkValue(record.remarks, "Counter"),
          };
        }),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load sales.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function ensureCustomerId(clientName: string) {
    const cleaned = clientName.trim();
    if (!cleaned) return null;

    const existing = customers.find(
      (customer) => customer.label.toLowerCase() === cleaned.toLowerCase(),
    );
    if (existing) return existing.id;

    const { data, error: insertError } = await supabase
      .from("customers")
      .insert({ name: cleaned })
      .select("id,name")
      .single();
    if (insertError) throw new Error(insertError.message);

    setCustomers((current) => [...current, { id: data.id, label: data.name }]);
    return data.id;
  }

  async function ensureSiteName(siteName: string) {
    const cleaned = siteName.trim();
    if (!cleaned) return null;

    const existing = sites.find(
      (site) => site.label.toLowerCase() === cleaned.toLowerCase(),
    );
    if (existing) return existing.label;

    const { data, error: insertError } = await supabase
      .from("project_sites")
      .insert({ name: cleaned })
      .select("id,name")
      .single();
    if (insertError) throw new Error(insertError.message);

    setSites((current) => [...current, { id: data.id, label: data.name }]);
    return data.name;
  }

  async function ensureDesignId(designLabel: string) {
    const cleaned = designLabel.trim();
    if (!cleaned) return null;

    const existing = designs.find(
      (design) => design.label.toLowerCase() === cleaned.toLowerCase(),
    );
    if (existing) return existing.id;

    const { data, error: insertError } = await supabase
      .from("concrete_designs")
      .insert({ code: cleaned })
      .select("id,code")
      .single();
    if (insertError) throw new Error(insertError.message);

    setDesigns((current) => [...current, { id: data.id, label: data.code }]);
    return data.id;
  }

  function getDesignFromLabel(label: string) {
    return (
      designs.find(
        (design) => design.label.toLowerCase() === label.trim().toLowerCase(),
      ) ?? null
    );
  }

  function designIdFromLabel(label: string) {
    return getDesignFromLabel(label)?.id ?? null;
  }

  function createBatchDrafts() {
    const startOrNumber = Number(form.sale_or_number || nextOrNumber);
    const count = Number(batchCount || 2);

    if (startOrNumber < nextOrNumber) {
      setError(
        `OR No must be ${nextOrNumber} or higher. Used or skipped numbers cannot be reused.`,
      );
      return;
    }

    setError("");
    setMessage("");
    const matchedDesign = getDesignFromLabel(form.design_label);
    const defaultPumpcreate = form.pumpcreate !== "" ? form.pumpcreate : (matchedDesign?.pumpcreate ?? "");

    setBatchDrafts(
      Array.from({ length: count }, (_, index) => ({
        ...form,
        id: `${Date.now()}-${index}`,
        sale_or_number: startOrNumber + index,
        concrete_design_id:
          form.concrete_design_id ?? matchedDesign?.id ?? null,
        pumpcreate: defaultPumpcreate,
      })),
    );
    setBatchModalOpen(true);
  }

  function updateBatchDraft(id: string, patch: Partial<BatchSaleDraft>) {
    setBatchDrafts((current) =>
      current.map((draft) =>
        draft.id === id ? { ...draft, ...patch } : draft,
      ),
    );
  }

  function updateBatchDraftOrNumber(id: string, value: number | "") {
    setBatchDrafts((current) => {
      const editedIndex = current.findIndex((draft) => draft.id === id);
      if (editedIndex === -1) return current;

      const minimumOrNumber =
        editedIndex === 0
          ? nextOrNumber
          : Number(
              current[editedIndex - 1].sale_or_number || nextOrNumber - 1,
            ) + 1;
      const editedOrNumber =
        value === "" ? "" : Math.max(Number(value), minimumOrNumber);

      return current.map((draft, index) => {
        if (index < editedIndex) return draft;
        if (index === editedIndex)
          return { ...draft, sale_or_number: editedOrNumber };
        if (editedOrNumber === "") return draft;

        return {
          ...draft,
          sale_or_number: editedOrNumber + index - editedIndex,
        };
      });
    });
  }

  function removeBatchDraft(id: string) {
    setBatchDrafts((current) => {
      const removedIndex = current.findIndex((draft) => draft.id === id);
      if (removedIndex === -1) return current;

      const filtered = current.filter((draft) => draft.id !== id);
      let previousOrNumber = 0;
      return filtered.map((draft, index) => {
        if (index < removedIndex || index === 0) {
          previousOrNumber = Number(draft.sale_or_number || previousOrNumber);
          return draft;
        }

        previousOrNumber += 1;
        return { ...draft, sale_or_number: previousOrNumber };
      });
    });
  }

  function closeBatchDrafts() {
    setBatchModalOpen(false);
    setBatchDrafts([]);
    setError("");
    setMessage("");
  }

  function validateSaleDraft(draft: SaleForm & { id?: string }, rowLabel = "Sale") {
    const orNumber = Number(draft.sale_or_number || 0);

    const isExistingRecord = draft.id && rows.some((r) => r.id === draft.id);
    const existingRecord = isExistingRecord ? rows.find((r) => r.id === draft.id) : null;
    const isKeepingOriginalOr = existingRecord && existingRecord.sale_or_number === orNumber;
    const isKeepingSingleEditedOr = editingSale && orNumber === editingSale.originalOrNumber;

    if (!isKeepingOriginalOr && !isKeepingSingleEditedOr && orNumber < nextOrNumber) {
      return `${rowLabel}: OR No must be ${nextOrNumber} or higher. Used or skipped numbers cannot be reused.`;
    }

    if (
      !draft.sale_date ||
      !draft.client_name.trim() ||
      !draft.design_label.trim() ||
      !draft.project_site.trim()
    ) {
      return `${rowLabel}: Date, Client Name, Design, Site, Cubic, and Price are required.`;
    }

    return "";
  }

  function startEditSale(row: SaleRow) {
    setEditingSale({ id: row.id, originalOrNumber: row.sale_or_number });
    setError("");
    setMessage("");
    const matchedDesign = getDesignFromLabel(row.design);
    setForm({
      sale_date: row.sale_date,
      sale_or_number: row.sale_or_number,
      client_name: row.client_name,
      concrete_design_id: matchedDesign?.id ?? null,
      design_label: row.design,
      project_site: row.site,
      cubic_volume: row.cubic_volume,
      unit_price: row.unit_price,
      pumpcreate: row.pumpcreate ?? matchedDesign?.pumpcreate ?? "",
      counter_date: row.counter_date,
      counter: row.counter,
    });
    requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    });
  }

  function cancelEditSale() {
    setEditingSale(null);
    setError("");
    setMessage("");
    setForm({ ...emptyForm, sale_or_number: nextOrNumber });
  }

  async function deleteSale(row: SaleRow) {
    if (!window.confirm("Are you sure you want to delete this sale? This will perform a hard delete.")) {
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");

    const { error: deleteError } = await supabase
      .from("sales_records")
      .delete()
      .eq("id", row.id);

    setLoading(false);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setMessage("Sale deleted successfully.");
    if (editingSale?.id === row.id) {
      cancelEditSale();
    }
    await loadRows();
  }

  async function deleteSelectedSales() {
    if (selectedSaleIds.size === 0) return;

    const count = selectedSaleIds.size;
    if (!window.confirm(`Are you sure you want to delete ${count} selected sale(s)? This will perform a hard delete.`)) {
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const idsToDelete = Array.from(selectedSaleIds).map(String);
      const { error: deleteError } = await supabase
        .from("sales_records")
        .delete()
        .in("id", idsToDelete);

      if (deleteError) throw new Error(deleteError.message);

      setMessage(`Successfully deleted ${count} sale(s).`);
      setSelectedSaleIds(new Set());
      if (editingSale && idsToDelete.includes(editingSale.id)) {
        cancelEditSale();
      }
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete selected sales.");
    } finally {
      setLoading(false);
    }
  }

  function startEditSelectedSales() {
    if (selectedSaleIds.size === 0) return;

    const selectedRows = rows.filter((row) => selectedSaleIds.has(row.id));
    if (selectedRows.length === 0) return;

    const drafts: BatchSaleDraft[] = selectedRows.map((row) => {
      const matchedDesign = getDesignFromLabel(row.design);
      return {
        id: row.id,
        sale_date: row.sale_date,
        sale_or_number: row.sale_or_number,
        client_name: row.client_name,
        concrete_design_id: matchedDesign?.id ?? null,
        design_label: row.design,
        project_site: row.site,
        cubic_volume: row.cubic_volume,
        unit_price: row.unit_price,
        pumpcreate: row.pumpcreate ?? "",
        counter_date: row.counter_date,
        counter: row.counter,
      };
    });

    setBatchDrafts(drafts);
    setBatchModalOpen(true);
  }

  async function saveBatchSales() {
    if (!isSupabaseConfigured) {
      setError("Supabase credentials are missing from .env.");
      return;
    }

    if (batchDrafts.length === 0) {
      setError("Create copies first before saving multiple sales.");
      return;
    }

    const usedOrNumbers = new Set<number>();
    for (const [index, draft] of batchDrafts.entries()) {
      const validationError = validateSaleDraft(draft, `Row ${index + 1}`);
      if (validationError) {
        setError(validationError);
        return;
      }

      const orNumber = Number(draft.sale_or_number || 0);
      if (usedOrNumbers.has(orNumber)) {
        setError(
          `Row ${index + 1}: OR No ${orNumber} is duplicated in the multiple sale list.`,
        );
        return;
      }
      usedOrNumbers.add(orNumber);
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const customerIds = new Map<string, string>();
      const siteNames = new Map<string, string>();
      const designIds = new Map<string, string>();

      const payload = [];
      let updatedCount = 0;
      let insertedCount = 0;

      for (const [index, draft] of batchDrafts.entries()) {
        const customerKey = draft.client_name.trim().toLowerCase();
        const siteKey = draft.project_site.trim().toLowerCase();
        const designKey = draft.design_label.trim().toLowerCase();

        let customerId = customerIds.get(customerKey);
        if (!customerId) {
          customerId = await ensureCustomerId(draft.client_name);
          if (!customerId) throw new Error("Client Name is required.");
          customerIds.set(customerKey, customerId);
        }

        let siteName = siteNames.get(siteKey);
        if (!siteName) {
          siteName = await ensureSiteName(draft.project_site);
          if (!siteName) throw new Error("Site is required.");
          siteNames.set(siteKey, siteName);
        }

        let designId = designIds.get(designKey);
        if (!designId) {
          designId = await ensureDesignId(draft.design_label);
          if (!designId) throw new Error("Design is required.");
          designIds.set(designKey, designId);
        }

        const isExistingRecord = rows.some((r) => r.id === draft.id);

        const saleRecordPayload = {
          sale_or_number: Number(draft.sale_or_number || 0),
          sale_date: draft.sale_date,
          customer_id: customerId,
          manual_customer_name: null,
          concrete_design_id: designId,
          project_site: siteName,
          cubic_volume: Number(draft.cubic_volume || 0),
          unit_price: Number(draft.unit_price || 0),
          pumpcreate: draft.pumpcreate === "" ? null : Number(draft.pumpcreate),
          remarks: buildRemarks(draft.counter_date, draft.counter),
        };

        if (isExistingRecord) {
          const { error: updateErr } = await supabase
            .from("sales_records")
            .update(saleRecordPayload)
            .eq("id", draft.id);
          if (updateErr) throw new Error(updateErr.message);
          updatedCount++;
        } else {
          const { error: insertErr } = await supabase
            .from("sales_records")
            .insert({ ...saleRecordPayload, payment_status: "unpaid" });
          if (insertErr) throw new Error(insertErr.message);
          insertedCount++;
        }
      }

      if (updatedCount > 0 && insertedCount === 0) {
        setMessage(`Updated ${updatedCount} sale(s) successfully.`);
      } else if (insertedCount > 0 && updatedCount === 0) {
        setMessage(`Saved ${insertedCount} new sale(s) successfully.`);
      } else {
        setMessage(`Saved ${insertedCount} new sale(s) and updated ${updatedCount} sale(s) successfully.`);
      }

      setBatchModalOpen(false);
      setBatchDrafts([]);
      setSelectedSaleIds(new Set());
      setForm({ ...emptyForm, sale_or_number: displayedNextOrNumber });
      await loadRows();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save multiple sales.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveSale() {
    if (!isSupabaseConfigured) {
      setError("Supabase credentials are missing from .env.");
      return;
    }

    const orNumber = Number(form.sale_or_number || 0);

    const validationError = validateSaleDraft(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const customerId = await ensureCustomerId(form.client_name);
      if (!customerId) throw new Error("Client Name is required.");
      const siteName = await ensureSiteName(form.project_site);
      if (!siteName) throw new Error("Site is required.");
      const designId = await ensureDesignId(form.design_label);
      if (!designId) throw new Error("Design is required.");

      const salePayload = {
        sale_or_number: orNumber,
        sale_date: form.sale_date,
        customer_id: customerId,
        manual_customer_name: null,
        concrete_design_id: designId,
        project_site: siteName,
        cubic_volume: Number(form.cubic_volume || 0),
        unit_price: Number(form.unit_price || 0),
        pumpcreate: form.pumpcreate === "" ? null : Number(form.pumpcreate),
        remarks: buildRemarks(form.counter_date, form.counter),
      };

      const { error: insertError } = editingSale
        ? await supabase
            .from("sales_records")
            .update(salePayload)
            .eq("id", editingSale.id)
        : await supabase
            .from("sales_records")
            .insert({ ...salePayload, payment_status: "unpaid" });

      if (insertError) throw new Error(insertError.message);

      setMessage(
        editingSale ? `Updated sale OR No ${orNumber}.` : `Saved sale OR No ${orNumber}.`,
      );
      setEditingSale(null);
      setForm({
        ...emptyForm,
        sale_or_number: Math.max(nextOrNumber, orNumber + 1),
      });
      await loadRows();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to save sale.",
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
      <Paper ref={formPanelRef} withBorder radius="sm" p="md" className="masterPanel">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void saveSale();
          }}
        >
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
              <DateShortcutInput
                label="Date"
                value={form.sale_date}
                onChange={(val) =>
                  setForm((current) => ({
                    ...current,
                    sale_date: val,
                  }))
                }
              />
              <NumberInput
                label="OR No"
                min={editingSale ? 1 : nextOrNumber}
                value={form.sale_or_number}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    sale_or_number: Number(value) || "",
                  }))
                }
              />
              <SuggestionTextInput
                label="Client Name"
                value={form.client_name}
                suggestions={customers.map((customer) => customer.label)}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, client_name: value }))
                }
                submitOnEnter={() => setTimeout(() => void saveSale(), 0)}
              />
              <SuggestionTextInput
                label="Design"
                value={form.design_label}
                suggestions={designs.map((design) => design.label)}
                onValueChange={(value) => {
                  const matched = getDesignFromLabel(value);
                  setForm((current) => ({
                    ...current,
                    design_label: value,
                    concrete_design_id: matched?.id ?? null,
                    pumpcreate:
                      matched && matched.pumpcreate != null
                        ? matched.pumpcreate
                        : matched
                          ? ""
                          : current.pumpcreate,
                  }));
                }}
                onCommit={(value) => {
                  const matched = getDesignFromLabel(value);
                  setForm((current) => ({
                    ...current,
                    design_label: value,
                    concrete_design_id: matched?.id ?? null,
                    pumpcreate:
                      matched && matched.pumpcreate != null
                        ? matched.pumpcreate
                        : matched
                          ? ""
                          : current.pumpcreate,
                  }));
                }}
                submitOnEnter={() => setTimeout(() => void saveSale(), 0)}
              />
              <SuggestionTextInput
                label="Site"
                value={form.project_site}
                suggestions={sites.map((site) => site.label)}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, project_site: value }))
                }
                submitOnEnter={() => setTimeout(() => void saveSale(), 0)}
              />
              <NumberInput
                label="Cubic"
                min={0}
                value={form.cubic_volume}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    cubic_volume: Number(value) || "",
                  }))
                }
              />
              <NumberInput
                label="Price"
                min={0}
                value={form.unit_price}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    unit_price: Number(value) || "",
                  }))
                }
              />
              {(getDesignFromLabel(form.design_label)?.pumpcreate != null || form.pumpcreate !== "") && (
                <NumberInput
                  label="Pumpcrete"
                  min={0}
                  value={form.pumpcreate}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      pumpcreate: Number(value) || "",
                    }))
                  }
                />
              )}
              <NumberInput
                label="Total"
                value={total}
                readOnly
                thousandSeparator=","
                decimalScale={2}
              />
              <DateShortcutInput
                label="Counter Date"
                value={form.counter_date}
                onChange={(val) =>
                  setForm((current) => ({
                    ...current,
                    counter_date: val,
                  }))
                }
                clearable={true}
              />
            </SimpleGrid>

            <Group justify="space-between">
              <Group>
                <Button
                  leftSection={<Save size={16} />}
                  type="submit"
                  loading={loading}
                >
                  {editingSale ? "Save Changes" : "Save Sale"}
                </Button>
                {editingSale && (
                  <Button
                    type="button"
                    leftSection={<X size={16} />}
                    variant="light"
                    color="gray"
                    onClick={cancelEditSale}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                )}
                <NumberInput
                  aria-label="Number of copies"
                  value={batchCount}
                  onChange={(e) => setBatchCount(e.toString())}
                  w={88}
                  disabled={Boolean(editingSale)}
                />
                <Button
                  type="button"
                  leftSection={<CopyPlus size={16} />}
                  variant="light"
                  onClick={createBatchDrafts}
                  disabled={loading || Boolean(editingSale)}
                >
                  Create Copies
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
              <Badge variant="light">Next OR No: {displayedNextOrNumber}</Badge>
            </Group>

            <Modal
              opened={batchModalOpen && hasBatchDrafts}
              onClose={closeBatchDrafts}
              title="Multiple Sales"
              size="95%"
              closeOnClickOutside={!loading}
              closeOnEscape={!loading}
            >
              <Stack gap="sm">
                <Group justify="space-between">
                  <Badge variant="outline">
                    {batchDrafts.length} editable sales ready
                  </Badge>
                  <Group>
                    <Button
                      type="button"
                      leftSection={<Save size={16} />}
                      onClick={saveBatchSales}
                      loading={loading}
                    >
                      Save Multiple Sales
                    </Button>
                  </Group>
                </Group>
                <ScrollArea type="auto">
                  <Table
                    className="batchSalesTable"
                    miw={800}
                    verticalSpacing="xs"
                  >
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>OR No</Table.Th>
                        <Table.Th>Date</Table.Th>
                        <Table.Th>Client Name</Table.Th>
                        <Table.Th>Design</Table.Th>
                        <Table.Th>Site</Table.Th>
                        <Table.Th>Cubic</Table.Th>
                        <Table.Th>Price</Table.Th>
                        <Table.Th>Pumpcrete</Table.Th>
                        <Table.Th>Total</Table.Th>
                        <Table.Th aria-label="Actions" />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {batchDrafts.map((draft, index) => {
                        const draftTotal =
                          Number(draft.cubic_volume || 0) *
                          Number(draft.unit_price || 0);
                        const minimumDraftOrNumber =
                          index === 0
                            ? nextOrNumber
                            : Number(
                                batchDrafts[index - 1].sale_or_number ||
                                  nextOrNumber - 1,
                              ) + 1;

                        return (
                          <Table.Tr key={draft.id}>
                            <Table.Td>
                              <NumberInput
                                min={minimumDraftOrNumber}
                                value={draft.sale_or_number}
                                onChange={(value) =>
                                  updateBatchDraftOrNumber(
                                    draft.id,
                                    Number(value) || "",
                                  )
                                }
                              />
                            </Table.Td>
                            <Table.Td>
                              <DateShortcutInput
                                value={draft.sale_date}
                                onChange={(val) =>
                                  updateBatchDraft(draft.id, {
                                    sale_date: val,
                                  })
                                }
                              />
                            </Table.Td>
                            <Table.Td>
                              <SuggestionTextInput
                                value={draft.client_name}
                                suggestions={customers.map(
                                  (customer) => customer.label,
                                )}
                                onValueChange={(value) =>
                                  updateBatchDraft(draft.id, {
                                    client_name: value,
                                  })
                                }
                              />
                            </Table.Td>
                            <Table.Td>
                              <SuggestionTextInput
                                value={draft.design_label}
                                suggestions={designs.map(
                                  (design) => design.label,
                                )}
                                onValueChange={(value) => {
                                  const matched = getDesignFromLabel(value);
                                  updateBatchDraft(draft.id, {
                                    design_label: value,
                                    concrete_design_id: matched?.id ?? null,
                                  });
                                }}
                                onCommit={(value) => {
                                  const matched = getDesignFromLabel(value);
                                  updateBatchDraft(draft.id, {
                                    design_label: value,
                                    concrete_design_id: matched?.id ?? null,
                                  });
                                }}
                              />
                            </Table.Td>
                            <Table.Td>
                              <SuggestionTextInput
                                value={draft.project_site}
                                suggestions={sites.map((site) => site.label)}
                                onValueChange={(value) =>
                                  updateBatchDraft(draft.id, {
                                    project_site: value,
                                  })
                                }
                              />
                            </Table.Td>
                            <Table.Td>
                              <NumberInput
                                min={0}
                                value={draft.cubic_volume}
                                onChange={(value) =>
                                  updateBatchDraft(draft.id, {
                                    cubic_volume: Number(value) || "",
                                  })
                                }
                              />
                            </Table.Td>
                            <Table.Td>
                              <NumberInput
                                min={0}
                                value={draft.unit_price}
                                onChange={(value) =>
                                  updateBatchDraft(draft.id, {
                                    unit_price: Number(value) || "",
                                  })
                                }
                              />
                            </Table.Td>
                            <Table.Td>
                              <NumberInput
                                min={0}
                                value={draft.pumpcreate}
                                onChange={(value) =>
                                  updateBatchDraft(draft.id, {
                                    pumpcreate: Number(value) || "",
                                  })
                                }
                              />
                            </Table.Td>
                            <Table.Td>
                              {draftTotal.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                              })}
                            </Table.Td>
                            <Table.Td>
                              <ActionIcon
                                type="button"
                                aria-label="Remove row"
                                color="red"
                                variant="subtle"
                                onClick={() => removeBatchDraft(draft.id)}
                              >
                                <Trash2 size={16} />
                              </ActionIcon>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              </Stack>
            </Modal>
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

      <Paper
        withBorder
        radius="sm"
        p="md"
        className="masterPanel"
      >
        <Group justify="space-between" mb="sm">
          <Badge variant="outline">Sales List</Badge>
          <Badge variant="light">
            {filteredRows.length} of {rows.length} records
          </Badge>
        </Group>
        <TextInput
          placeholder="Search any sale"
          value={salesSearch}
          onChange={(event) => setSalesSearch(event.currentTarget.value)}
        />
      </Paper>

      {selectedSaleIds.size > 0 && (
        <Paper withBorder radius="sm" p="xs" style={{ backgroundColor: "var(--mantine-color-blue-light)" }}>
          <Group justify="space-between">
            <Badge variant="filled" color="blue">
              {selectedSaleIds.size} sale(s) selected
            </Badge>
            <Group gap="xs">
              <Button
                size="xs"
                leftSection={<Edit3 size={14} />}
                onClick={startEditSelectedSales}
              >
                Edit Selected ({selectedSaleIds.size})
              </Button>
              <Button
                size="xs"
                color="red"
                leftSection={<Trash2 size={14} />}
                onClick={deleteSelectedSales}
                loading={loading}
              >
                Delete Selected ({selectedSaleIds.size})
              </Button>
              <Button
                size="xs"
                variant="light"
                onClick={() => {
                  const selectedRows = rows.filter((r) => selectedSaleIds.has(r.id));
                  if (selectedRows.length > 0) {
                    handleCounterClick(selectedRows[0], selectedRows);
                  }
                }}
              >
                Counter Date ({selectedSaleIds.size})
              </Button>
              <Button
                size="xs"
                variant="subtle"
                color="gray"
                leftSection={<X size={14} />}
                onClick={() => setSelectedSaleIds(new Set())}
              >
                Deselect
              </Button>
            </Group>
          </Group>
        </Paper>
      )}

      <CustomExcelTable
        columns={saleColumns}
        data={filteredRows}
        onEditClick={(row) => startEditSale(row)}
        onDeleteClick={(row) => deleteSale(row)}
        withSelection={true}
        checkedRowIds={selectedSaleIds}
        onCheckedRowIdsChange={setSelectedSaleIds}
        contextMenuItems={["edit", "delete", "counter_date"]}
        onCounterClick={handleCounterClick}
        renderRowActions={(row) => (
          <Group gap="xs" justify="center">
            <Button
              size="xs"
              variant="subtle"
              leftSection={<Edit3 size={14} />}
              onClick={() => startEditSale(row)}
            >
              Edit
            </Button>
            <Button
              size="xs"
              variant="subtle"
              color="red"
              leftSection={<Trash2 size={14} />}
              onClick={() => deleteSale(row)}
            >
              Delete
            </Button>
          </Group>
        )}
        renderCell={(row, column) => {
          if (column.key !== "payment_status") return undefined;

          const isPaid = row.payment_status === "paid";
          return (
            <Badge color={isPaid ? "green" : "red"} variant="light">
              {isPaid ? "paid" : "unpaid"}
            </Badge>
          );
        }}
      />

      <Modal
        opened={counterModalOpen}
        onClose={() => {
          if (!loading) {
            setCounterModalOpen(false);
            setCounterTargetRows([]);
          }
        }}
        title="Update Counter Date"
        centered
        closeOnClickOutside={!loading}
        closeOnEscape={!loading}
      >
        <Stack gap="md">
          <Badge variant="outline">
            Updating counter date for {counterTargetRows.length} record(s)
          </Badge>
          <DateShortcutInput
            label="Counter Date"
            value={counterDateValue}
            onChange={(val) => setCounterDateValue(val)}
            disabled={loading}
            clearable={true}
          />
          <Group justify="flex-end">
            <Button
              variant="light"
              color="gray"
              onClick={() => {
                setCounterModalOpen(false);
                setCounterTargetRows([]);
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={saveCounterDateValue}
              loading={loading}
            >
              Save Counter Date
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
