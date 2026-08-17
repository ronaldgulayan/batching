import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  ActionIcon,
  Badge,
  Button,
  Group,
  FileInput,
  Loader,
  LoadingOverlay,
  Modal,
  NumberInput,
  Paper,
  Progress,
  ScrollArea,
  Select,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import {
  AlertCircle,
  CopyPlus,
  Edit3,
  FileSpreadsheet,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  X,
  CreditCard,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  CustomExcelTable,
  type ExcelColumn,
} from "../components/CustomExcelTable";
import { SuggestionTextInput } from "../components/SuggestionTextInput";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { DateShortcutInput } from "../components/DateShortcutInput";
import { useSnackbar } from "../context/SnackbarContext";

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
  paid_amount?: number;
  balance_amount?: number;
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
  sales_payments?: { amount: number }[] | null;
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

const REQUIRED_EXCEL_COLUMNS = [
  { key: "date", name: "Date", aliases: ["DATE", "SALE DATE", "SALEDATE"] },
  { key: "or_no", name: "DR NO", aliases: ["DR NO", "DR NO.", "DR_NO", "DRNO", "DR NUMBER", "DR", "OR NO", "OR NO.", "OR_NO", "ORNO", "OR NUMBER", "OR"] },
  { key: "client_name", name: "CLIENT NAME", aliases: ["CLIENT NAME", "CLIENT_NAME", "CLIENTNAME", "CLIENT", "CUSTOMER NAME", "CUSTOMER"] },
  { key: "design", name: "DESIGN", aliases: ["DESIGN", "MIX CODE", "CONCRETE DESIGN", "DESIGN CODE"] },
  { key: "site", name: "SITE", aliases: ["SITE", "PROJECT SITE", "LOCATION"] },
  { key: "cubic", name: "CUBIC", aliases: ["CUBIC", "CUBICS", "CUBIC VOLUME", "VOLUME"] },
  { key: "price", name: "PRICE", aliases: ["PRICE", "UNIT PRICE", "UNITPRICE"] },
  { key: "payment_date", name: "PAYMENT DATE", aliases: ["PAYMENT DATE", "PAYMENT_DATE", "PAYMENTDATE", "PAYMENT"] },
  { key: "type", name: "TYPE", aliases: ["TYPE", "PAYMENT TYPE", "PAYMENT METHOD", "METHOD"] },
  { key: "counter", name: "COUNTER", aliases: ["COUNTER", "COUNTER DATE", "COUNTERDATE"] },
  { key: "sales", name: "SALES", aliases: ["SALES", "SALES PERSON", "SALESPERSON", "AGENT"] },
  { key: "pumpcrete", name: "PUMPCRETE", aliases: ["PUMPCRETE", "PUMPCRETE FEE", "PUMP"] },
];

function parseExcelDate(val: any): string {
  if (!val) return today();
  if (typeof val === "number") {
    try {
      const dateObj = XLSX.SSF.parse_date_code(val);
      if (dateObj) {
        const y = dateObj.y;
        const m = String(dateObj.m).padStart(2, "0");
        const d = String(dateObj.d).padStart(2, "0");
        return `${y}-${m}-${d}`;
      }
    } catch {
      // fallback
    }
  }
  const str = String(val).trim();
  if (!str) return today();
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return str;
}

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
    label: "DR No",
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
  const { showSuccess, showError } = useSnackbar();
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

  // Pay Single Sale Modal State
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payingSale, setPayingSale] = useState<SaleRow | null>(null);
  const [payForm, setPayForm] = useState({
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: "Cash",
    amount: 0,
    ck_number: "",
    sales_person: "",
    remarks: "Paid",
  });
  const [salesPeople, setSalesPeople] = useState<Lookup[]>([]);
  const [salesSearch, setSalesSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "unpaid" | "paid" | "deposit">("all");
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [readingSheets, setReadingSheets] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [importStats, setImportStats] = useState<{
    totalInFile: number;
    imported: number;
    skipped: number;
    processed: number;
    remaining: number;
  } | null>(null);
  const importCancelledRef = useRef(false);
  const [importSuccess, setImportSuccess] = useState("");
  const [importError, setImportError] = useState("");
  const hasBatchDrafts = batchDrafts.length > 0;

  const handleCancelImport = () => {
    importCancelledRef.current = true;
  };

  const handleFileSelectionChange = async (file: File | null) => {
    setSelectedFile(file);
    setImportSuccess("");
    setImportError("");
    setImportProgress(null);
    setAvailableSheets([]);
    setSelectedSheet("");

    if (file) {
      setReadingSheets(true);
      try {
        await new Promise((r) => setTimeout(r, 50));
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        if (workbook.SheetNames && workbook.SheetNames.length > 0) {
          setAvailableSheets(workbook.SheetNames);
          setSelectedSheet(workbook.SheetNames[0]);
        }
      } catch (e: any) {
        console.warn("Could not read sheet names from workbook:", e);
        setImportError("Failed to parse sheet names from Excel file.");
      } finally {
        setReadingSheets(false);
      }
    }
  };

  async function handleImportExcel() {
    if (!selectedFile) return;
    if (!isSupabaseConfigured) {
      setImportError("Supabase credentials are missing from .env.");
      return;
    }

    importCancelledRef.current = false;
    setImporting(true);
    setImportError("");
    setImportSuccess("");
    setImportProgress(null);
    setImportStats(null);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const targetSheetName = selectedSheet || workbook.SheetNames[0];
      if (!targetSheetName) throw new Error("Walang laman o sira ang Excel file.");

      const sheet = workbook.Sheets[targetSheetName];
      if (!sheet) throw new Error(`Target sheet/tab "${targetSheetName}" was not found in the Excel file.`);

      const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
      if (jsonRows.length === 0) throw new Error("No data rows found in the Excel file.");

      // Check column headers from first row
      const actualHeaders = Object.keys(jsonRows[0]);
      const normalizedActualHeaders = actualHeaders.map((h) =>
        h.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
      );

      // Validate required columns
      const missingColumns: string[] = [];
      REQUIRED_EXCEL_COLUMNS.forEach((col) => {
        const isFound = col.aliases.some((alias) => {
          const normAlias = alias.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
          return normalizedActualHeaders.includes(normAlias);
        });
        if (!isFound) {
          missingColumns.push(col.name);
        }
      });

      if (missingColumns.length > 0) {
        throw new Error(
          `Missing required column(s) in your Excel file: ${missingColumns.join(", ")}`
        );
      }

      // Value extraction helper
      const getColVal = (row: Record<string, any>, colDef: (typeof REQUIRED_EXCEL_COLUMNS)[0]) => {
        for (const k of Object.keys(row)) {
          const normK = k.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
          for (const alias of colDef.aliases) {
            const normAlias = alias.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
            if (normK === normAlias) {
              return row[k];
            }
          }
        }
        return "";
      };

      let salesInsertedCount = 0;
      let paymentsInsertedCount = 0;

      type RawParsedItem = {
        rawDate: any;
        orNum: number;
        clientName: string;
        designLabel: string;
        projectSite: string;
        cubicVal: number;
        priceVal: number;
        rawPaymentDate: any;
        paymentType: string;
        counterVal: string;
        salesPerson: string;
        pumpVal: number;
      };

      const parsedItems: RawParsedItem[] = [];
      const uniqueOrNumbers = new Set<number>();
      const clientNameSet = new Set<string>();
      const siteNameSet = new Set<string>();
      const designLabelSet = new Set<string>();

      // Step 1: Parse and collect all valid rows
      for (const row of jsonRows) {
        const rawDate = getColVal(row, REQUIRED_EXCEL_COLUMNS[0]);
        const rawOrNo = getColVal(row, REQUIRED_EXCEL_COLUMNS[1]);
        const clientName = String(getColVal(row, REQUIRED_EXCEL_COLUMNS[2]) || "").trim();
        const designLabel = String(getColVal(row, REQUIRED_EXCEL_COLUMNS[3]) || "").trim();
        const projectSite = String(getColVal(row, REQUIRED_EXCEL_COLUMNS[4]) || "").trim();
        const cubicVal = Number(getColVal(row, REQUIRED_EXCEL_COLUMNS[5]) || 0);
        const priceVal = Number(getColVal(row, REQUIRED_EXCEL_COLUMNS[6]) || 0);
        const rawPaymentDate = getColVal(row, REQUIRED_EXCEL_COLUMNS[7]);
        const paymentType = String(getColVal(row, REQUIRED_EXCEL_COLUMNS[8]) || "").trim();
        const counterVal = String(getColVal(row, REQUIRED_EXCEL_COLUMNS[9]) || "").trim();
        const salesPerson = String(getColVal(row, REQUIRED_EXCEL_COLUMNS[10]) || "").trim();
        const pumpVal = Number(getColVal(row, REQUIRED_EXCEL_COLUMNS[11]) || 0);

        const orNum = Number(rawOrNo || 0);
        const hasRawDate = Boolean(rawDate && String(rawDate).trim() !== "");

        // STRICT VALIDATION: Row must have complete Date, DR NO, Client Name, Design, Site, Cubic (>0), Price (>0)
        if (
          !hasRawDate ||
          !orNum ||
          !clientName ||
          !designLabel ||
          !projectSite ||
          !cubicVal ||
          !priceVal
        ) {
          continue; // Skip incomplete row completely
        }

        parsedItems.push({
          rawDate,
          orNum,
          clientName,
          designLabel,
          projectSite,
          cubicVal,
          priceVal,
          rawPaymentDate,
          paymentType,
          counterVal,
          salesPerson,
          pumpVal,
        });

        uniqueOrNumbers.add(orNum);
        clientNameSet.add(clientName);
        siteNameSet.add(projectSite);
        designLabelSet.add(designLabel);
      }

      if (parsedItems.length === 0) {
        throw new Error(
          "No complete sales records found in the Excel file. Please ensure rows contain Date, DR NO, Client Name, Design, Site, Cubic (>0), and Price (>0)."
        );
      }

      // Step 2: Check existing DR numbers in database to skip duplicates
      const orNumberArray = Array.from(uniqueOrNumbers);
      const { data: existingSales, error: fetchErr } = await supabase
        .from("sales_records")
        .select("sale_or_number")
        .in("sale_or_number", orNumberArray);

      if (fetchErr) throw new Error(`Database check error: ${fetchErr.message}`);

      const existingOrSet = new Set((existingSales || []).map((s) => s.sale_or_number));
      const seenOrsInFile = new Set<number>();
      const newItemsToImport: RawParsedItem[] = [];

      for (const item of parsedItems) {
        if (existingOrSet.has(item.orNum) || seenOrsInFile.has(item.orNum)) {
          continue;
        }
        seenOrsInFile.add(item.orNum);
        newItemsToImport.push(item);
      }

      const duplicateCount = parsedItems.length - newItemsToImport.length;

      const totalInFile = parsedItems.length;
      let processedCount = duplicateCount;
      let remainingCount = totalInFile - processedCount;

      setImportStats({
        totalInFile,
        imported: 0,
        skipped: duplicateCount,
        processed: processedCount,
        remaining: remainingCount,
      });

      if (newItemsToImport.length === 0) {
        setImportSuccess(
          `All ${parsedItems.length} record(s) in this Excel file already exist in the database. 0 new records inserted.`
        );
        return;
      }

      // Step 3: Ensure lookups exist
      for (const cName of clientNameSet) {
        if (importCancelledRef.current) break;
        await ensureCustomerId(cName);
      }
      for (const sName of siteNameSet) {
        if (importCancelledRef.current) break;
        await ensureSiteName(sName);
      }
      for (const dLabel of designLabelSet) {
        if (importCancelledRef.current) break;
        await ensureDesignId(dLabel);
      }

      if (importCancelledRef.current) {
        setImportError("Import process cancelled by user.");
        return;
      }

      // Step 4: Build payloads
      const salesToInsertPayloads = [];
      const paymentInfoList: { orNum: number; rawPaymentDate: any; paymentType: string; salesPerson: string; fullTotal: number }[] = [];

      for (const item of newItemsToImport) {
        const saleDate = parseExcelDate(item.rawDate);
        const customerId = await ensureCustomerId(item.clientName);
        const siteName = await ensureSiteName(item.projectSite);
        const designId = await ensureDesignId(item.designLabel);

        const hasPaymentDate = Boolean(item.rawPaymentDate && String(item.rawPaymentDate).trim() !== "");
        const fullTotal = item.cubicVal * item.priceVal + item.pumpVal;

        salesToInsertPayloads.push({
          sale_or_number: item.orNum,
          sale_date: saleDate,
          customer_id: customerId,
          manual_customer_name: null,
          concrete_design_id: designId,
          project_site: siteName,
          cubic_volume: item.cubicVal,
          unit_price: item.priceVal,
          pumpcreate: item.pumpVal > 0 ? item.pumpVal : null,
          payment_status: hasPaymentDate ? "paid" : "unpaid",
          remarks: buildRemarks("", item.counterVal),
        });

        if (hasPaymentDate) {
          paymentInfoList.push({
            orNum: item.orNum,
            rawPaymentDate: item.rawPaymentDate,
            paymentType: item.paymentType,
            salesPerson: item.salesPerson,
            fullTotal,
          });
        }
      }

      // Step 5: Batch insert sales records in chunks of 100
      const chunkSize = 100;

      for (let i = 0; i < salesToInsertPayloads.length; i += chunkSize) {
        if (importCancelledRef.current) {
          setImportError(
            `Import cancelled by user. Stopped at ${processedCount} of ${totalInFile} records (${salesInsertedCount} inserted, ${duplicateCount} skipped).`
          );
          break;
        }

        const chunk = salesToInsertPayloads.slice(i, i + chunkSize);

        const { data: insertedChunk, error: batchSalesErr } = await supabase
          .from("sales_records")
          .upsert(chunk, { onConflict: "sale_or_number", ignoreDuplicates: true })
          .select("id, sale_or_number");

        if (batchSalesErr) throw new Error(`Batch insert error: ${batchSalesErr.message}`);
        const chunkInserted = insertedChunk?.length || 0;
        salesInsertedCount += chunkInserted;
        processedCount += chunkInserted;
        remainingCount = Math.max(0, totalInFile - processedCount);

        setImportStats({
          totalInFile,
          imported: salesInsertedCount,
          skipped: duplicateCount,
          processed: processedCount,
          remaining: remainingCount,
        });

        // Map inserted record IDs by sale_or_number for payments
        const insertedMap = new Map((insertedChunk || []).map((rec) => [rec.sale_or_number, rec.id]));

        // Step 6: Batch insert payments for this chunk
        const chunkPaymentPayloads = [];
        for (const pInfo of paymentInfoList) {
          const recordId = insertedMap.get(pInfo.orNum);
          if (recordId) {
            const paymentDate = parseExcelDate(pInfo.rawPaymentDate);
            const paymentRemarksParts = [];
            if (pInfo.salesPerson) paymentRemarksParts.push(`Sales: ${pInfo.salesPerson}`);
            paymentRemarksParts.push("Term: Paid");

            chunkPaymentPayloads.push({
              sales_record_id: recordId,
              payment_date: paymentDate,
              amount: pInfo.fullTotal,
              payment_method: pInfo.paymentType ? pInfo.paymentType.toUpperCase() : "CASH",
              reference_number: null,
              remarks: paymentRemarksParts.join(" | "),
            });
          }
        }

        if (chunkPaymentPayloads.length > 0) {
          const { data: insertedPayments, error: payBatchErr } = await supabase
            .from("sales_payments")
            .insert(chunkPaymentPayloads)
            .select("id");

          if (payBatchErr) {
            console.warn("Payment batch insert notice:", payBatchErr.message);
          } else {
            paymentsInsertedCount += (insertedPayments?.length || 0);
          }
        }
      }

      if (!importCancelledRef.current) {
        let resultMsg = `Import complete! Successfully inserted ${salesInsertedCount} new sales record(s)`;
        if (paymentsInsertedCount > 0) resultMsg += ` and ${paymentsInsertedCount} payment(s)`;
        if (duplicateCount > 0) resultMsg += `. (${duplicateCount} existing duplicate record(s) were skipped)`;
        resultMsg += `!`;

        setImportSuccess(resultMsg);
        showSuccess(resultMsg, "Import Successful");
      }
      await loadRows();
    } catch (err: any) {
      const errMsg = err?.message || "Failed to process Excel file.";
      setImportError(errMsg);
      showError(errMsg);
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  }

  const total = useMemo(
    () => Number(form.cubic_volume || 0) * Number(form.unit_price || 0) + Number(form.pumpcreate || 0),
    [form.cubic_volume, form.unit_price, form.pumpcreate],
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
    return rows.filter((row) => {
      const matchesSearch =
        !cleaned ||
        [
          `DR ${row.sale_or_number}`,
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
          .includes(cleaned);

      const matchesStatus =
        statusFilter === "all" || row.payment_status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [rows, salesSearch, statusFilter]);

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
      salesPeopleResult,
    ] = await Promise.all([
      supabase.from("customers").select("id,name").order("name"),
      supabase.from("concrete_designs").select("id,code,pumpcreate").order("code"),
      supabase.from("project_sites").select("id,name").order("name"),
      supabase.from("sales_people").select("id,name").order("name"),
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
    if (salesPeopleResult?.data) {
      setSalesPeople(
        salesPeopleResult.data.map((sp) => ({
          id: sp.id,
          label: sp.name,
        })),
      );
    }
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
          "id,sale_or_number,sale_date,customer_id,manual_customer_name,project_site,cubic_volume,unit_price,pumpcreate,total_amount,payment_status,customers(name),concrete_designs(code,pumpcreate),remarks,sales_payments(amount)",
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
          const pumpVal = Number(record.pumpcreate ?? designPumpcreate ?? 0);
          const baseTotal = Number(record.total_amount || 0);
          const fullTotal = baseTotal + pumpVal;
          const paymentsList = Array.isArray(record.sales_payments)
            ? record.sales_payments
            : record.sales_payments
            ? [record.sales_payments]
            : [];
          const paidSum = paymentsList.reduce((sum, p) => sum + Number(p.amount || 0), 0);
          const balance = Math.max(0, fullTotal - paidSum);

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
            total_amount: fullTotal,
            paid_amount: paidSum,
            balance_amount: balance,
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

    // Check database directly in case it exists in DB but not in React state yet
    const { data: dbCustomer } = await supabase
      .from("customers")
      .select("id,name")
      .ilike("name", cleaned)
      .maybeSingle();

    if (dbCustomer) {
      setCustomers((current) => {
        if (!current.some((c) => c.id === dbCustomer.id)) {
          return [...current, { id: dbCustomer.id, label: dbCustomer.name }];
        }
        return current;
      });
      return dbCustomer.id;
    }

    const { data, error: insertError } = await supabase
      .from("customers")
      .insert({ name: cleaned })
      .select("id,name")
      .single();

    if (insertError) {
      // Handle race condition or duplicate key conflict
      const { data: fallbackCustomer } = await supabase
        .from("customers")
        .select("id,name")
        .ilike("name", cleaned)
        .single();
      if (fallbackCustomer) {
        setCustomers((current) => [...current, { id: fallbackCustomer.id, label: fallbackCustomer.name }]);
        return fallbackCustomer.id;
      }
      throw new Error(insertError.message);
    }

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

    // Check database directly in case it exists in DB but not in React state yet
    const { data: dbSite } = await supabase
      .from("project_sites")
      .select("id,name")
      .ilike("name", cleaned)
      .maybeSingle();

    if (dbSite) {
      setSites((current) => {
        if (!current.some((s) => s.id === dbSite.id)) {
          return [...current, { id: dbSite.id, label: dbSite.name }];
        }
        return current;
      });
      return dbSite.name;
    }

    const { data, error: insertError } = await supabase
      .from("project_sites")
      .upsert({ name: cleaned }, { onConflict: "name" })
      .select("id,name")
      .single();

    if (insertError) {
      const { data: fallbackSite } = await supabase
        .from("project_sites")
        .select("id,name")
        .ilike("name", cleaned)
        .single();
      if (fallbackSite) {
        setSites((current) => [...current, { id: fallbackSite.id, label: fallbackSite.name }]);
        return fallbackSite.name;
      }
      throw new Error(insertError.message);
    }

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

    // Check database directly in case it exists in DB but not in React state yet
    const { data: dbDesign } = await supabase
      .from("concrete_designs")
      .select("id,code")
      .ilike("code", cleaned)
      .maybeSingle();

    if (dbDesign) {
      setDesigns((current) => {
        if (!current.some((d) => d.id === dbDesign.id)) {
          return [...current, { id: dbDesign.id, label: dbDesign.code }];
        }
        return current;
      });
      return dbDesign.id;
    }

    const { data, error: insertError } = await supabase
      .from("concrete_designs")
      .upsert({ code: cleaned }, { onConflict: "code" })
      .select("id,code")
      .single();

    if (insertError) {
      const { data: fallbackDesign } = await supabase
        .from("concrete_designs")
        .select("id,code")
        .ilike("code", cleaned)
        .single();
      if (fallbackDesign) {
        setDesigns((current) => [...current, { id: fallbackDesign.id, label: fallbackDesign.code }]);
        return fallbackDesign.id;
      }
      throw new Error(insertError.message);
    }

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
        `DR No must be ${nextOrNumber} or higher. Used or skipped numbers cannot be reused.`,
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
      return `${rowLabel}: DR No must be ${nextOrNumber} or higher. Used or skipped numbers cannot be reused.`;
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
    if (row.payment_status === "paid") {
      setError(`DR No. ${row.sale_or_number} is already paid and cannot be edited.`);
      return;
    }
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
    if (row.payment_status === "paid") {
      setError(`DR No. ${row.sale_or_number} is already paid and cannot be deleted.`);
      return;
    }
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
      showError(deleteError.message);
      return;
    }

    const deleteMsg = `Sale DR No. ${row.sale_or_number} deleted successfully.`;
    setMessage(deleteMsg);
    showSuccess(deleteMsg);
    if (editingSale?.id === row.id) {
      cancelEditSale();
    }
    await loadRows();
  }

  async function deleteSelectedSales() {
    if (selectedSaleIds.size === 0) return;

    const paidInSelection = Array.from(selectedSaleIds).filter((id) => {
      const r = rows.find((sale) => sale.id === id);
      return r?.payment_status === "paid";
    });

    if (paidInSelection.length > 0) {
      const errTxt = `Cannot delete ${paidInSelection.length} selected sale(s) because they are already marked as Paid.`;
      setError(errTxt);
      showError(errTxt);
      return;
    }

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

      const batchDelMsg = `Successfully deleted ${count} sale(s).`;
      setMessage(batchDelMsg);
      showSuccess(batchDelMsg);
      setSelectedSaleIds(new Set());
      if (editingSale && idsToDelete.includes(editingSale.id)) {
        cancelEditSale();
      }
      await loadRows();
    } catch (err) {
      const errTxt = err instanceof Error ? err.message : "Unable to delete selected sales.";
      setError(errTxt);
      showError(errTxt);
    } finally {
      setLoading(false);
    }
  }

  function startEditSelectedSales() {
    if (selectedSaleIds.size === 0) return;

    const paidInSelection = Array.from(selectedSaleIds).filter((id) => {
      const r = rows.find((sale) => sale.id === id);
      return r?.payment_status === "paid";
    });

    if (paidInSelection.length > 0) {
      setError(`Cannot edit ${paidInSelection.length} selected sale(s) because they are already marked as Paid.`);
      return;
    }

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
      setError("No editable sales to save.");
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
          `Row ${index + 1}: DR No ${orNumber} is duplicated in the multiple sale list.`,
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

      let saveMsg = "";
      if (updatedCount > 0 && insertedCount === 0) {
        saveMsg = `Updated ${updatedCount} sale(s) successfully.`;
      } else if (insertedCount > 0 && updatedCount === 0) {
        saveMsg = `Saved ${insertedCount} new sale(s) successfully.`;
      } else {
        saveMsg = `Saved ${insertedCount} new sale(s) and updated ${updatedCount} sale(s) successfully.`;
      }

      setMessage(saveMsg);
      showSuccess(saveMsg);

      setBatchModalOpen(false);
      setBatchDrafts([]);
      setSelectedSaleIds(new Set());
      setForm({ ...emptyForm, sale_or_number: displayedNextOrNumber });
      await loadRows();
    } catch (saveError) {
      const errTxt = saveError instanceof Error ? saveError.message : "Unable to save multiple sales.";
      setError(errTxt);
      showError(errTxt);
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

      const msg = editingSale ? `Updated sale DR No ${orNumber}.` : `Saved sale DR No ${orNumber}.`;
      setMessage(msg);
      showSuccess(msg);
      setEditingSale(null);
      setForm({
        ...emptyForm,
        sale_or_number: Math.max(nextOrNumber, orNumber + 1),
      });
      await loadRows();
    } catch (saveError) {
      const errTxt = saveError instanceof Error ? saveError.message : "Unable to save sale.";
      setError(errTxt);
      showError(errTxt);
    } finally {
      setLoading(false);
    }
  }

  function handlePaySale(sale: SaleRow) {
    if (sale.payment_status === "paid") {
      showError(`DR No. ${sale.sale_or_number} is already fully paid.`);
      return;
    }
    const balance = sale.balance_amount !== undefined ? sale.balance_amount : sale.total_amount;
    setPayingSale(sale);
    setPayForm({
      payment_date: new Date().toISOString().slice(0, 10),
      payment_method: "Cash",
      amount: balance,
      ck_number: "",
      sales_person: "",
      remarks: "Paid",
    });
    setPayModalOpen(true);
  }

  async function submitSalePayment() {
    if (!payingSale) return;
    if (Number(payForm.amount) <= 0) {
      showError("Payment amount must be greater than 0.");
      return;
    }
    if (payForm.payment_method === "CK" && !payForm.ck_number.trim()) {
      showError("CK Number is required for Check payments.");
      return;
    }

    setLoading(true);
    try {
      const parts = [];
      if (payForm.sales_person.trim()) {
        parts.push(`Sales: ${payForm.sales_person.trim()}`);
      }
      if (payForm.remarks.trim()) {
        parts.push(payForm.remarks.trim());
      }
      const remarksVal = parts.join(" | ");

      const { error: insertErr } = await supabase.from("sales_payments").insert({
        sales_record_id: payingSale.id,
        payment_date: payForm.payment_date,
        amount: Number(payForm.amount),
        payment_method: payForm.payment_method,
        reference_number: payForm.payment_method === "CK" ? payForm.ck_number.trim() : null,
        remarks: remarksVal || null,
      });

      if (insertErr) throw new Error(insertErr.message);

      const nextPaidAmount = (payingSale.paid_amount || 0) + Number(payForm.amount);
      const targetAmount = payingSale.total_amount;
      const nextStatus = nextPaidAmount >= targetAmount ? "paid" : "deposit";

      const { error: updateErr } = await supabase
        .from("sales_records")
        .update({ payment_status: nextStatus })
        .eq("id", payingSale.id);

      if (updateErr) throw new Error(updateErr.message);

      const msg = `Payment of ₱${Number(payForm.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} for DR No. ${payingSale.sale_or_number} saved successfully.`;
      showSuccess(msg);
      setPayModalOpen(false);
      setPayingSale(null);
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
        visible={loading && !importing}
        zIndex={1000}
        transitionProps={{ duration: 0 }}
        overlayProps={{ opacity: 0.35, blur: 0.5 }}
        loaderProps={{ color: "blue", type: "bars", size: "lg" }}
        style={{ position: "fixed", inset: 0 }}
      />
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
                label="DR No"
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
                <Button
                  type="button"
                  leftSection={<Upload size={16} />}
                  variant="light"
                  color="teal"
                  onClick={() => setImportModalOpen(true)}
                  disabled={loading || Boolean(editingSale)}
                >
                  Import Data
                </Button>
              </Group>
              <Badge variant="light">Next DR No: {displayedNextOrNumber}</Badge>
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
                        <Table.Th>DR No</Table.Th>
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
                            Number(draft.unit_price || 0) +
                          Number(draft.pumpcreate || 0);
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
        <Group justify="space-between" align="center" wrap="wrap" gap="xs" mb="sm">
          <Group gap="xs">
            <Badge variant="outline">Sales List</Badge>
            <SegmentedControl
              size="xs"
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as any)}
              data={[
                { label: "All", value: "all" },
                { label: "Unpaid", value: "unpaid" },
                { label: "Paid", value: "paid" },
                { label: "Deposit", value: "deposit" },
              ]}
            />
          </Group>
          <Badge variant="light">
            {filteredRows.length} of {rows.length} records
          </Badge>
        </Group>
        <TextInput
          placeholder="Search any sale (DR, Client Name, Site, Design...)"
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
        onPayClick={(row) => handlePaySale(row)}
        onEditClick={(row) => startEditSale(row)}
        onDeleteClick={(row) => deleteSale(row)}
        withSelection={true}
        checkedRowIds={selectedSaleIds}
        onCheckedRowIdsChange={setSelectedSaleIds}
        contextMenuItems={["pay", "edit", "delete", "counter_date"]}
        onCounterClick={handleCounterClick}
        renderRowActions={(row) => {
          const isPaid = row.payment_status === "paid";
          if (isPaid) {
            return (
              <Group gap="xs" justify="center">
                <Badge color="green" variant="light" size="xs">
                  Paid (Locked)
                </Badge>
              </Group>
            );
          }
          return (
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
          );
        }}
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

      <Modal
        opened={importModalOpen}
        onClose={() => {
          if (!importing) {
            setImportModalOpen(false);
            setSelectedFile(null);
            setImportSuccess("");
            setImportError("");
          }
        }}
        title={<Text fw={700} size="lg">Import Sales Data from Excel</Text>}
        size="lg"
        centered
      >
        <Stack gap="md">
          <Alert color="blue" title="Required Excel Column Headers">
            Please make sure your Excel file (.xlsx, .xls, .csv) contains the following column headers in Row 1:
          </Alert>

          <Paper withBorder p="md" radius="sm">
            <Group gap="xs" wrap="wrap">
              <Badge color="blue" size="lg" variant="filled">Date</Badge>
              <Badge color="blue" size="lg" variant="filled">DR NO</Badge>
              <Badge color="blue" size="lg" variant="filled">CLIENT NAME</Badge>
              <Badge color="blue" size="lg" variant="filled">DESIGN</Badge>
              <Badge color="blue" size="lg" variant="filled">SITE</Badge>
              <Badge color="blue" size="lg" variant="filled">CUBIC</Badge>
              <Badge color="blue" size="lg" variant="filled">PRICE</Badge>
              <Badge color="blue" size="lg" variant="filled">PAYMENT DATE</Badge>
              <Badge color="blue" size="lg" variant="filled">TYPE</Badge>
              <Badge color="blue" size="lg" variant="filled">COUNTER</Badge>
              <Badge color="blue" size="lg" variant="filled">SALES</Badge>
              <Badge color="blue" size="lg" variant="filled">PUMPCRETE</Badge>
            </Group>
          </Paper>

          {importError && <Alert color="red" title="Import Error">{importError}</Alert>}
          {importSuccess && <Alert color="green" title="Import Success">{importSuccess}</Alert>}

          <FileInput
            label="Select Excel File"
            placeholder="Select Excel File (.xlsx, .xls, .csv)..."
            accept=".xlsx, .xls, .csv"
            value={selectedFile}
            onChange={handleFileSelectionChange}
            clearable
            disabled={importing || readingSheets}
            leftSection={<FileSpreadsheet size={16} />}
          />

          {readingSheets && (
            <Paper
              withBorder
              p="xs"
              radius="sm"
              style={{ backgroundColor: "rgba(15, 23, 42, 0.4)", borderColor: "rgba(59, 130, 246, 0.2)" }}
            >
              <Group gap="xs" align="center">
                <Loader size="xs" color="blue" />
                <Text size="xs" c="blue.3">
                  Reading available sheets/tabs from Excel file... Please wait.
                </Text>
              </Group>
            </Paper>
          )}

          {selectedFile && !readingSheets && (
            <Select
              label="Target Sheet / Tab"
              placeholder="Select Excel sheet/tab to import..."
              data={
                availableSheets.length > 0
                  ? availableSheets.map((s) => ({ value: s, label: s }))
                  : selectedSheet
                  ? [{ value: selectedSheet, label: selectedSheet }]
                  : []
              }
              value={selectedSheet}
              onChange={(val) => setSelectedSheet(val || "")}
              allowDeselect={false}
              disabled={importing}
              checkIconPosition="right"
              leftSection={<FileSpreadsheet size={16} />}
            />
          )}

          {importing && (
            <Paper
              withBorder
              p="md"
              radius="sm"
              style={{ backgroundColor: "rgba(15, 23, 42, 0.75)", borderColor: "rgba(59, 130, 246, 0.3)" }}
            >
              <Stack gap="md">
                <Group justify="space-between" align="center">
                  <Group gap="sm">
                    <Loader size="sm" color="blue" />
                    <Text size="sm" fw={600} c="blue.4">
                      Importing Excel Data... Please wait
                    </Text>
                  </Group>
                  <Button
                    size="xs"
                    color="red"
                    variant="light"
                    leftSection={<X size={14} />}
                    onClick={handleCancelImport}
                  >
                    Cancel Import
                  </Button>
                </Group>

                {importStats && (
                  <>
                    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
                      <Paper p="xs" radius="xs" style={{ backgroundColor: "rgba(255,255,255,0.03)", textAlign: "center" }}>
                        <Text size="xs" c="dimmed">Total Rows</Text>
                        <Text fw={700} size="md" c="blue.3">{importStats.totalInFile}</Text>
                      </Paper>
                      <Paper p="xs" radius="xs" style={{ backgroundColor: "rgba(34,197,94,0.08)", textAlign: "center" }}>
                        <Text size="xs" c="green.4">Imported (New)</Text>
                        <Text fw={700} size="md" c="green.4">{importStats.imported}</Text>
                      </Paper>
                      <Paper p="xs" radius="xs" style={{ backgroundColor: "rgba(234,179,8,0.08)", textAlign: "center" }}>
                        <Text size="xs" c="yellow.4">Skipped (Duplicate)</Text>
                        <Text fw={700} size="md" c="yellow.4">{importStats.skipped}</Text>
                      </Paper>
                      <Paper p="xs" radius="xs" style={{ backgroundColor: "rgba(239,68,68,0.08)", textAlign: "center" }}>
                        <Text size="xs" c="orange.4">Remaining</Text>
                        <Text fw={700} size="md" c="orange.4">{importStats.remaining}</Text>
                      </Paper>
                    </SimpleGrid>

                    <Progress
                      value={(importStats.processed / importStats.totalInFile) * 100}
                      animated
                      color="blue"
                      size="md"
                      radius="xl"
                    />
                  </>
                )}
              </Stack>
            </Paper>
          )}

          <Group justify="flex-end" mt="md">
            <Button
              variant="light"
              color="gray"
              onClick={() => {
                setImportModalOpen(false);
                setSelectedFile(null);
                setImportSuccess("");
                setImportError("");
              }}
              disabled={importing || readingSheets}
            >
              Cancel
            </Button>
            <Button
              color="teal"
              leftSection={<Upload size={16} />}
              disabled={!selectedFile || importing || readingSheets}
              loading={importing}
              onClick={handleImportExcel}
            >
              Start Import
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Pay Single Sale DR Modal */}
      <Modal
        opened={payModalOpen}
        onClose={() => {
          setPayModalOpen(false);
          setPayingSale(null);
        }}
        title={
          <Group gap="xs">
            <CreditCard size={18} color="#10b981" />
            <Text fw={700} size="md">
              Pay Single DR No. {payingSale?.sale_or_number}
            </Text>
          </Group>
        }
        size="lg"
        centered
      >
        {payingSale && (
          <Stack gap="md">
            <Paper p="sm" radius="xs" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
                <div>
                  <Text size="xs" c="dimmed">Client Name</Text>
                  <Text size="sm" fw={600}>{payingSale.client_name}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Date</Text>
                  <Text size="sm">{payingSale.sale_date}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Total Amount</Text>
                  <Text size="sm" fw={600}>₱{payingSale.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Remaining Balance</Text>
                  <Text size="sm" fw={700} c="red.4">
                    ₱{(payingSale.balance_amount !== undefined ? payingSale.balance_amount : payingSale.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Text>
                </div>
              </SimpleGrid>
            </Paper>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <DateShortcutInput
                label="Payment Date"
                value={payForm.payment_date}
                onChange={(val) => setPayForm((p) => ({ ...p, payment_date: val }))}
              />
              <Select
                label="Payment Method"
                data={["Cash", "CK", "Online", "Deposit"]}
                value={payForm.payment_method}
                onChange={(val) => setPayForm((p) => ({ ...p, payment_method: val || "Cash" }))}
              />
            </SimpleGrid>

            {payForm.payment_method === "CK" && (
              <TextInput
                label="CK Number"
                placeholder="Check number..."
                value={payForm.ck_number}
                onChange={(e) => setPayForm((p) => ({ ...p, ck_number: e.currentTarget.value }))}
                required
              />
            )}

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
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
              <SuggestionTextInput
                label="Sales Agent / Person"
                value={payForm.sales_person}
                onValueChange={(val: string) => setPayForm((p) => ({ ...p, sales_person: val }))}
                suggestions={salesPeople.map((sp) => sp.label)}
                placeholder="Enter sales agent name..."
              />
            </SimpleGrid>

            <TextInput
              label="Remarks / Note"
              placeholder="e.g. Paid, Partial Deposit, Counter..."
              value={payForm.remarks}
              onChange={(e) => setPayForm((p) => ({ ...p, remarks: e.currentTarget.value }))}
            />

            <Group justify="flex-end" mt="md">
              <Button
                variant="light"
                color="gray"
                onClick={() => {
                  setPayModalOpen(false);
                  setPayingSale(null);
                }}
              >
                Cancel
              </Button>
              <Button
                color="teal"
                leftSection={<CreditCard size={16} />}
                onClick={submitSalePayment}
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
