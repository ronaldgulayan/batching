import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Group,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  TextInput,
  Text,
  SegmentedControl,
  MultiSelect,
} from "@mantine/core";
import { AlertCircle, Edit3, RefreshCw, Save, Trash2, X } from "lucide-react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { CustomExcelTable, type ExcelColumn } from "../components/CustomExcelTable";
import { DateShortcutInput } from "../components/DateShortcutInput";
import { SuggestionTextInput } from "../components/SuggestionTextInput";

type PaymentMethod = "Cash" | "CK" | "Online" | "Deposit" | "CASH" | "ONLINE" | "DEPOSIT";

const isCKMethod = (method: string | null | undefined) => method?.toUpperCase() === "CK";

type PayableSale = {
  id: string;
  sale_or_number: number;
  sale_date: string;
  customer_name: string;
  total_amount: number;
  pumpcrete: number;
  paid_amount: number;
  balance_amount: number;
  payment_status: string;
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

type PayableGraba = {
  id: string;
  graba_dr_number: string;
  graba_date: string;
  supplier_name: string;
  items: string;
  truck: string;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
};

type PaidGraba = PayableGraba & {
  payment_id: string;
  payment_date: string;
  payment_amount: number;
  payment_method: string;
  ck_number: string;
  remarks: string;
};

type PayableSupplier = {
  id: string;
  dr_number: string;
  transaction_date: string;
  supplier_name: string;
  item_name: string;
  qty: number;
  price: number;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
};

type PaidSupplier = PayableSupplier & {
  payment_id: string;
  payment_date: string;
  payment_amount: number;
  ck_number: string;
  po_number: string;
  remarks: "Paid" | "Collect";
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

type GrabaPaymentRecord = {
  id: string;
  graba_record_id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  remarks: string | null;
};

type SupplierPaymentRecord = {
  id: string;
  supplier_transaction_id: string;
  payment_date: string;
  amount: number;
  ck_number: string | null;
  po_number: string | null;
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
  remarks: string;
  po_number: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm: PaymentForm = {
  payment_date: today(),
  payment_method: "Cash",
  sales_person: "",
  ck_number: "",
  edit_amount: "",
  total_amount_paid: "",
  term: "",
  remarks: "Paid",
  po_number: "",
};

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: "Cash", label: "Cash" },
  { value: "CK", label: "CK" },
  { value: "Online", label: "Online" },
  { value: "Deposit", label: "Deposit" },
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
  const [activeTab, setActiveTab] = useState<"sales" | "graba" | "supplier">("sales");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Validation errors
  const [paymentDateError, setPaymentDateError] = useState("");
  const [salesFieldError, setSalesFieldError] = useState("");
  const [ckNumberError, setCkNumberError] = useState("");
  const [editAmountError, setEditAmountError] = useState("");

  const [form, setForm] = useState<PaymentForm>(emptyForm);

  // Sales State
  const [payableSales, setPayableSales] = useState<PayableSale[]>([]);
  const [paidSales, setPaidSales] = useState<PaidSale[]>([]);
  const [selectedUnpaidRowIds, setSelectedUnpaidRowIds] = useState<Set<string | number>>(new Set());
  const [salesPeople, setSalesPeople] = useState<SalesPerson[]>([]);
  const [editingPayment, setEditingPayment] = useState<{
    paymentId: string;
    saleId: string;
    oldAmount: number;
    totalAmount: number;
    paidAmount: number;
  } | null>(null);
  const [unpaidSearch, setUnpaidSearch] = useState("");
  const [selectedUnpaidDates, setSelectedUnpaidDates] = useState<string[]>([]);
  const [paidSearch, setPaidSearch] = useState("");

  // Graba State
  const [payableGraba, setPayableGraba] = useState<PayableGraba[]>([]);
  const [paidGraba, setPaidGraba] = useState<PaidGraba[]>([]);
  const [selectedUnpaidGrabaRowIds, setSelectedUnpaidGrabaRowIds] = useState<Set<string | number>>(new Set());
  const [editingGrabaPayment, setEditingGrabaPayment] = useState<{
    paymentId: string;
    grabaRecordId: string;
    oldAmount: number;
    totalAmount: number;
    paidAmount: number;
  } | null>(null);
  const [unpaidGrabaSearch, setUnpaidGrabaSearch] = useState("");
  const [paidGrabaSearch, setPaidGrabaSearch] = useState("");

  // Supplier State
  const [payableSupplier, setPayableSupplier] = useState<PayableSupplier[]>([]);
  const [paidSupplier, setPaidSupplier] = useState<PaidSupplier[]>([]);
  const [selectedUnpaidSupplierRowIds, setSelectedUnpaidSupplierRowIds] = useState<Set<string | number>>(new Set());
  const [editingSupplierPayment, setEditingSupplierPayment] = useState<{
    paymentId: string;
    supplierTransactionId: string;
    oldAmount: number;
    totalAmount: number;
    paidAmount: number;
  } | null>(null);
  const [unpaidSupplierSearch, setUnpaidSupplierSearch] = useState("");
  const [paidSupplierSearch, setPaidSupplierSearch] = useState("");

  // Graba derivations
  const selectedGrabaDrafts = useMemo(
    () => payableGraba.filter((g) => selectedUnpaidGrabaRowIds.has(g.id)),
    [payableGraba, selectedUnpaidGrabaRowIds]
  );

  const selectedGrabaBalanceTotal = useMemo(
    () => selectedGrabaDrafts.reduce((sum, g) => sum + g.balance_amount, 0),
    [selectedGrabaDrafts]
  );

  // Supplier derivations
  const selectedSupplierDrafts = useMemo(
    () => payableSupplier.filter((s) => selectedUnpaidSupplierRowIds.has(s.id)),
    [payableSupplier, selectedUnpaidSupplierRowIds]
  );

  const selectedSupplierBalanceTotal = useMemo(
    () => selectedSupplierDrafts.reduce((sum, s) => sum + s.balance_amount, 0),
    [selectedSupplierDrafts]
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

  function grabaMatchesSearch(g: PayableGraba, searchValue: string) {
    const cleaned = searchValue.trim().toLowerCase();
    if (!cleaned) return true;
    const paidDetail = g as Partial<PaidGraba>;

    return [
      `DR ${g.graba_dr_number}`,
      g.graba_dr_number,
      g.graba_date,
      g.supplier_name,
      g.items,
      g.truck,
      g.total_amount,
      g.paid_amount,
      g.balance_amount,
      displayMoney(g.total_amount),
      displayMoney(g.paid_amount),
      displayMoney(g.balance_amount),
      paidDetail.payment_date ?? "",
      paidDetail.payment_amount ?? "",
      paidDetail.payment_amount ? displayMoney(paidDetail.payment_amount) : "",
      paidDetail.payment_method ?? "",
      paidDetail.ck_number ?? "",
      paidDetail.remarks ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(cleaned);
  }

  function supplierMatchesSearch(s: PayableSupplier, searchValue: string) {
    const cleaned = searchValue.trim().toLowerCase();
    if (!cleaned) return true;
    const paidDetail = s as Partial<PaidSupplier>;

    return [
      `DR ${s.dr_number}`,
      s.dr_number,
      s.transaction_date,
      s.supplier_name,
      s.item_name,
      s.qty,
      s.price,
      s.total_amount,
      s.paid_amount,
      s.balance_amount,
      displayMoney(s.total_amount),
      displayMoney(s.paid_amount),
      displayMoney(s.balance_amount),
      paidDetail.payment_date ?? "",
      paidDetail.payment_amount ?? "",
      paidDetail.payment_amount ? displayMoney(paidDetail.payment_amount) : "",
      paidDetail.ck_number ?? "",
      paidDetail.po_number ?? "",
      paidDetail.remarks ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(cleaned);
  }

  const availableUnpaidDates = useMemo(() => {
    const datesSet = new Set<string>();
    payableSales.forEach((s) => {
      if (s.sale_date) datesSet.add(s.sale_date);
    });
    return Array.from(datesSet).sort((a, b) => b.localeCompare(a));
  }, [payableSales]);

  const filteredPayableSales = useMemo(
    () =>
      payableSales.filter((sale) => {
        const matchesSearch = saleMatchesSearch(sale, unpaidSearch);
        const matchesDate =
          selectedUnpaidDates.length === 0 || selectedUnpaidDates.includes(sale.sale_date);
        return matchesSearch && matchesDate;
      }),
    [payableSales, unpaidSearch, selectedUnpaidDates]
  );

  useEffect(() => {
    setSelectedUnpaidRowIds(new Set());
  }, [selectedUnpaidDates, unpaidSearch]);

  // Sales derivations
  const selectedDrafts = useMemo(
    () => filteredPayableSales.filter((sale) => selectedUnpaidRowIds.has(sale.id)),
    [filteredPayableSales, selectedUnpaidRowIds]
  );

  const selectedConcreteTotal = useMemo(
    () => selectedDrafts.reduce((sum, sale) => sum + Math.max(0, sale.total_amount - sale.paid_amount), 0),
    [selectedDrafts]
  );

  const selectedPumpcreteTotal = useMemo(() => {
    const distinctPumpcrete = new Set<number>();
    selectedDrafts.forEach((sale) => {
      if (sale.pumpcrete && sale.pumpcrete > 0) {
        distinctPumpcrete.add(sale.pumpcrete);
      }
    });
    return Array.from(distinctPumpcrete).reduce((sum, val) => sum + val, 0);
  }, [selectedDrafts]);

  const selectedBalanceTotal = useMemo(
    () => selectedConcreteTotal + selectedPumpcreteTotal,
    [selectedConcreteTotal, selectedPumpcreteTotal]
  );

  useEffect(() => {
    if (activeTab === "sales" && !editingPayment) {
      setForm((current) => ({
        ...current,
        total_amount_paid: selectedBalanceTotal > 0 ? selectedBalanceTotal : "",
      }));
    }
  }, [selectedBalanceTotal, activeTab, editingPayment]);

  const filteredPaidSales = useMemo(
    () => paidSales.filter((sale) => saleMatchesSearch(sale, paidSearch)),
    [paidSales, paidSearch]
  );

  const filteredPayableGraba = useMemo(
    () => payableGraba.filter((g) => grabaMatchesSearch(g, unpaidGrabaSearch)),
    [payableGraba, unpaidGrabaSearch]
  );

  const filteredPaidGraba = useMemo(
    () => paidGraba.filter((g) => grabaMatchesSearch(g, paidGrabaSearch)),
    [paidGraba, paidGrabaSearch]
  );

  const filteredPayableSupplier = useMemo(
    () => payableSupplier.filter((s) => supplierMatchesSearch(s, unpaidSupplierSearch)),
    [payableSupplier, unpaidSupplierSearch]
  );

  const filteredPaidSupplier = useMemo(
    () => paidSupplier.filter((s) => supplierMatchesSearch(s, paidSupplierSearch)),
    [paidSupplier, paidSupplierSearch]
  );

  const unpaidColumns = useMemo<ExcelColumn<PayableSale>[]>(
    () => [
      { key: "sale_or_number", label: "OR", type: "text", width: 90 },
      { key: "sale_date", label: "Date", type: "date", width: 120 },
      { key: "customer_name", label: "Client Name", width: 220 },
      { key: "total_amount", label: "Total Amount", type: "number", width: 150 },
      { key: "paid_amount", label: "Paid", type: "number", width: 140 },
      { key: "balance_amount", label: "Balance", type: "number", width: 150 },
    ],
    []
  );

  const paidColumns = useMemo<ExcelColumn<PaidSale>[]>(
    () => [
      { key: "sale_or_number", label: "OR", type: "text", width: 90 },
      { key: "sale_date", label: "Date", type: "date", width: 120 },
      { key: "customer_name", label: "Client Name", width: 220 },
      { key: "total_amount", label: "Total Amount", type: "number", width: 150 },
      { key: "payment_amount", label: "Payment Amt", type: "number", width: 140 },
      { key: "payment_method", label: "Method", width: 120 },
      { key: "ck_number", label: "CK No.", width: 120 },
      { key: "sales_person", label: "Sales Person", width: 180 },
      { key: "term", label: "Term/Details", width: 220 },
      { key: "payment_date", label: "Payment Date", type: "date", width: 130 },
    ],
    []
  );

  const unpaidGrabaColumns = useMemo<ExcelColumn<PayableGraba>[]>(
    () => [
      { key: "graba_dr_number", label: "DR", type: "text", width: 90 },
      { key: "graba_date", label: "Date", type: "date", width: 120 },
      { key: "supplier_name", label: "Supplier", width: 220 },
      { key: "items", label: "Items", width: 160 },
      { key: "truck", label: "Truck", width: 120 },
      { key: "total_amount", label: "Total", type: "number", width: 140 },
      { key: "paid_amount", label: "Paid", type: "number", width: 130 },
      { key: "balance_amount", label: "Balance", type: "number", width: 140 },
    ],
    []
  );

  const paidGrabaColumns = useMemo<ExcelColumn<PaidGraba>[]>(
    () => [
      { key: "graba_dr_number", label: "DR", type: "text", width: 90 },
      { key: "graba_date", label: "Date", type: "date", width: 120 },
      { key: "supplier_name", label: "Supplier", width: 220 },
      { key: "payment_amount", label: "Payment Amt", type: "number", width: 140 },
      { key: "payment_method", label: "Method", width: 110 },
      { key: "ck_number", label: "Cheque No", width: 110 },
      { key: "remarks", label: "Remarks", width: 200 },
      { key: "payment_date", label: "Payment Date", type: "date", width: 130 },
    ],
    []
  );

  const unpaidSupplierColumns = useMemo<ExcelColumn<PayableSupplier>[]>(
    () => [
      { key: "dr_number", label: "DR", type: "text", width: 90 },
      { key: "transaction_date", label: "Date", type: "date", width: 120 },
      { key: "supplier_name", label: "Supplier", width: 220 },
      { key: "item_name", label: "Item", width: 160 },
      { key: "qty", label: "Qty", type: "number", width: 90 },
      { key: "price", label: "Price", type: "number", width: 110 },
      { key: "total_amount", label: "Total", type: "number", width: 140 },
      { key: "paid_amount", label: "Paid", type: "number", width: 130 },
      { key: "balance_amount", label: "Balance", type: "number", width: 140 },
    ],
    []
  );

  const paidSupplierColumns = useMemo<ExcelColumn<PaidSupplier>[]>(
    () => [
      { key: "dr_number", label: "DR", type: "text", width: 90 },
      { key: "transaction_date", label: "Date", type: "date", width: 120 },
      { key: "supplier_name", label: "Supplier", width: 220 },
      { key: "payment_amount", label: "Payment Amt", type: "number", width: 140 },
      { key: "ck_number", label: "CK Number", width: 110 },
      { key: "po_number", label: "PO No", width: 110 },
      { key: "remarks", label: "Remarks", width: 110 },
      { key: "payment_date", label: "Payment Date", type: "date", width: 130 },
    ],
    []
  );

  async function loadRows() {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError("");
    setPaymentDateError("");
    setSalesFieldError("");
    setCkNumberError("");
    setEditAmountError("");
    setMessage("");

    try {
      const [
        salesRecordsResult,
        salesPaymentsResult,
        salesPeopleResult,
        grabaSummaryResult,
        grabaPaymentsResult,
        supplierSummaryResult,
        supplierPaymentsResult,
      ] = await Promise.all([
        supabase
          .from("sales_records")
          .select("id,sale_or_number,sale_date,cubic_volume,unit_price,total_amount,pumpcreate,manual_customer_name,customers(name),concrete_designs(pumpcreate)")
          .order("sale_or_number", { ascending: false }),
        supabase
          .from("sales_payments")
          .select("id,sales_record_id,payment_date,amount,payment_method,reference_number,remarks")
          .order("created_at", { ascending: false }),
        supabase.from("sales_people").select("id,name").order("name"),
        supabase.from("graba_summary").select("*").order("graba_dr_number", { ascending: false }),
        supabase.from("graba_payments").select("*").order("created_at", { ascending: false }),
        supabase.from("supplier_billing_summary").select("*").order("dr_number", { ascending: false }),
        supabase.from("supplier_payments").select("*").order("created_at", { ascending: false }),
      ]);

      if (salesRecordsResult.error) throw new Error(salesRecordsResult.error.message);
      if (salesPaymentsResult.error) throw new Error(salesPaymentsResult.error.message);
      if (salesPeopleResult.error) throw new Error(salesPeopleResult.error.message);
      if (grabaSummaryResult.error) throw new Error(grabaSummaryResult.error.message);
      if (grabaPaymentsResult.error) throw new Error(grabaPaymentsResult.error.message);
      if (supplierSummaryResult.error) throw new Error(supplierSummaryResult.error.message);
      if (supplierPaymentsResult.error) throw new Error(supplierPaymentsResult.error.message);

      // Process Sales
      const allSalesPayments = (salesPaymentsResult.data ?? []) as SalesPaymentRecord[];
      const salesPaidMap = new Map<string, number>();
      const latestSalesPaymentById = new Map<string, SalesPaymentRecord>();

      for (const payment of allSalesPayments) {
        const currentTotal = salesPaidMap.get(payment.sales_record_id) ?? 0;
        salesPaidMap.set(payment.sales_record_id, currentTotal + Number(payment.amount || 0));

        if (!latestSalesPaymentById.has(payment.sales_record_id)) {
          latestSalesPaymentById.set(payment.sales_record_id, payment);
        }
      }

      const rawSalesRecords = (salesRecordsResult.data ?? []) as any[];
      const sales: PayableSale[] = rawSalesRecords.map((record) => {
        const custName = Array.isArray(record.customers)
          ? record.customers[0]?.name
          : record.customers?.name;
        const customerName = custName ?? record.manual_customer_name ?? "";

        const designPumpcreate = Array.isArray(record.concrete_designs)
          ? record.concrete_designs[0]?.pumpcreate
          : record.concrete_designs?.pumpcreate;
        const pumpcreateVal = Number(record.pumpcreate ?? designPumpcreate ?? 0);
        const baseTotal = Number(record.total_amount || 0);
        const fullTotal = baseTotal + pumpcreateVal;

        const paidAmount = salesPaidMap.get(record.id) ?? 0;
        const dbStatus = record.payment_status as string | undefined;
        const isFullyPaid = dbStatus === "paid" || (baseTotal > 0 && paidAmount >= baseTotal);
        const paymentStatus = isFullyPaid ? "paid" : dbStatus ?? (paidAmount > 0 ? "deposit" : "unpaid");
        const balanceAmount = isFullyPaid ? 0 : Math.max(0, fullTotal - paidAmount);

        return {
          id: record.id,
          sale_or_number: Number(record.sale_or_number || 0),
          sale_date: record.sale_date,
          customer_name: customerName,
          total_amount: baseTotal,
          pumpcrete: pumpcreateVal,
          paid_amount: paidAmount,
          balance_amount: balanceAmount,
          payment_status: paymentStatus,
        };
      });

      const openSales = sales.filter((sale) => sale.payment_status !== "paid" && sale.balance_amount > 0);
      const closedSales = sales.filter((sale) => sale.payment_status === "paid" || sale.balance_amount <= 0);

      setPayableSales(openSales);
      setPaidSales(
        closedSales.map((sale) => {
          const payment = latestSalesPaymentById.get(sale.id);
          const method = payment?.payment_method ?? "";

          return {
            ...sale,
            payment_id: payment?.id ?? "",
            payment_date: payment?.payment_date ?? "",
            payment_amount: Number(payment?.amount || 0),
            payment_method: method,
            ck_number: isCKMethod(method) ? (payment?.reference_number ?? "") : "",
            sales_person: remarkValue(payment?.remarks ?? null, "Sales"),
            term: remarkValue(payment?.remarks ?? null, "Term"),
          };
        })
      );

      // Process Graba
      const grabas = ((grabaSummaryResult.data ?? []) as unknown as PayableGraba[]).map(
        (g) => ({
          id: g.id,
          graba_dr_number: g.graba_dr_number ? String(g.graba_dr_number) : "",
          graba_date: g.graba_date,
          supplier_name: g.supplier_name ?? "No supplier",
          items: g.items ?? "",
          truck: g.truck ?? "",
          total_amount: Number(g.total_amount || 0),
          paid_amount: Number(g.paid_amount || 0),
          balance_amount: Number(g.balance_amount || 0),
        })
      );
      const openGraba = grabas.filter((g) => g.balance_amount > 0);
      const closedGraba = grabas.filter((g) => g.balance_amount <= 0);
      const latestGrabaPaymentById = new Map<string, GrabaPaymentRecord>();
      for (const payment of (grabaPaymentsResult.data ?? []) as unknown as GrabaPaymentRecord[]) {
        if (!latestGrabaPaymentById.has(payment.graba_record_id)) {
          latestGrabaPaymentById.set(payment.graba_record_id, payment);
        }
      }

      setPayableGraba(openGraba);
      setPaidGraba(
        closedGraba.map((g) => {
          const payment = latestGrabaPaymentById.get(g.id);
          const method = payment?.payment_method ?? "";
          return {
            ...g,
            payment_id: payment?.id ?? "",
            payment_date: payment?.payment_date ?? "",
            payment_amount: Number(payment?.amount || 0),
            payment_method: method,
            ck_number: isCKMethod(method) ? (payment?.reference_number ?? "") : "",
            remarks: method.toUpperCase() === "CASH" ? "Counter" : isCKMethod(method) ? "Paid" : "",
          };
        })
      );

      // Process Supplier Transactions
      const supplierTrans = ((supplierSummaryResult.data ?? []) as unknown as PayableSupplier[]).map(
        (s) => ({
          id: s.id,
          dr_number: s.dr_number ? String(s.dr_number) : "",
          transaction_date: s.transaction_date,
          supplier_name: s.supplier_name ?? "",
          item_name: s.item_name ?? "",
          qty: Number(s.qty || 0),
          price: Number(s.price || 0),
          total_amount: Number(s.total_amount || 0),
          paid_amount: Number(s.paid_amount || 0),
          balance_amount: Number(s.balance_amount || 0),
        })
      );
      const openSupplier = supplierTrans.filter((s) => s.balance_amount > 0);
      const closedSupplier = supplierTrans.filter((s) => s.balance_amount <= 0);
      const latestSupplierPaymentById = new Map<string, SupplierPaymentRecord>();
      for (const payment of (supplierPaymentsResult.data ?? []) as unknown as SupplierPaymentRecord[]) {
        if (!latestSupplierPaymentById.has(payment.supplier_transaction_id)) {
          latestSupplierPaymentById.set(payment.supplier_transaction_id, payment);
        }
      }

      setPayableSupplier(openSupplier);
      setPaidSupplier(
        closedSupplier.map((s) => {
          const payment = latestSupplierPaymentById.get(s.id);
          return {
            ...s,
            payment_id: payment?.id ?? "",
            payment_date: payment?.payment_date ?? "",
            payment_amount: Number(payment?.amount || 0),
            ck_number: payment?.ck_number ?? "",
            po_number: payment?.po_number ?? "",
            remarks: (payment?.remarks as "Paid" | "Collect") ?? "Paid",
          };
        })
      );

      setSalesPeople(
        ((salesPeopleResult.data ?? []) as { id: string; name: string }[]).map(
          (person) => ({
            id: person.id,
            label: person.name,
          })
        )
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load data.");
    } finally {
      setLoading(false);
    }
  }

  function startEditSalesPayment(row: PaidSale) {
    setEditingPayment({
      paymentId: row.payment_id,
      saleId: row.id,
      oldAmount: row.payment_amount,
      totalAmount: row.total_amount + row.pumpcrete,
      paidAmount: row.paid_amount,
    });
    setForm({
      payment_date: row.payment_date,
      payment_method: row.payment_method as PaymentMethod,
      sales_person: row.sales_person,
      ck_number: row.ck_number,
      edit_amount: row.payment_amount,
      total_amount_paid: "",
      term: row.term,
      remarks: "",
      po_number: "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEditGrabaPayment(row: PaidGraba) {
    setEditingGrabaPayment({
      paymentId: row.payment_id,
      grabaRecordId: row.id,
      oldAmount: row.payment_amount,
      totalAmount: row.total_amount,
      paidAmount: row.paid_amount,
    });
    setForm({
      payment_date: row.payment_date,
      payment_method: row.payment_method as PaymentMethod,
      sales_person: "",
      ck_number: row.ck_number,
      edit_amount: row.payment_amount,
      total_amount_paid: "",
      term: "",
      remarks: "",
      po_number: "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEditSupplierPayment(row: PaidSupplier) {
    setEditingSupplierPayment({
      paymentId: row.payment_id,
      supplierTransactionId: row.id,
      oldAmount: row.payment_amount,
      totalAmount: row.total_amount,
      paidAmount: row.paid_amount,
    });
    setForm({
      payment_date: row.payment_date,
      payment_method: "CK",
      sales_person: "",
      ck_number: row.ck_number,
      edit_amount: row.payment_amount,
      total_amount_paid: "",
      term: "",
      remarks: row.remarks,
      po_number: row.po_number,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditPayment() {
    setEditingPayment(null);
    setEditingGrabaPayment(null);
    setEditingSupplierPayment(null);
    setForm(emptyForm);
  }

  async function deleteSalesPayment(row: PaidSale) {
    if (!window.confirm("Are you sure you want to delete this payment?")) return;
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const { error: deleteError } = await supabase
        .from("sales_payments")
        .delete()
        .eq("id", row.payment_id);
      if (deleteError) throw new Error(deleteError.message);

      const nextPaidAmount = row.paid_amount - row.payment_amount;
      const targetAmount = row.total_amount + row.pumpcrete;
      const status = nextPaidAmount >= targetAmount ? "paid" : nextPaidAmount > 0 ? "deposit" : "unpaid";
      const { error: statusError } = await supabase
        .from("sales_records")
        .update({ payment_status: status })
        .eq("id", row.id);
      if (statusError) throw new Error(statusError.message);

      setMessage("Payment deleted successfully.");
      await loadRows();
    } catch (err: any) {
      setError(err.message || "Failed to delete payment.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteGrabaPayment(row: PaidGraba) {
    if (!window.confirm("Are you sure you want to delete this payment?")) return;
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const { error: deleteError } = await supabase
        .from("graba_payments")
        .delete()
        .eq("id", row.payment_id);
      if (deleteError) throw new Error(deleteError.message);

      const nextPaidAmount = row.paid_amount - row.payment_amount;
      const status = nextPaidAmount >= row.total_amount ? "paid" : nextPaidAmount > 0 ? "deposit" : "unpaid";
      const { error: statusError } = await supabase
        .from("graba_records")
        .update({ payment_status: status })
        .eq("id", row.id);
      if (statusError) throw new Error(statusError.message);

      setMessage("Payment deleted successfully.");
      await loadRows();
    } catch (err: any) {
      setError(err.message || "Failed to delete payment.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteSupplierPayment(row: PaidSupplier) {
    if (!window.confirm("Are you sure you want to delete this payment?")) return;
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const { error: deleteError } = await supabase
        .from("supplier_payments")
        .delete()
        .eq("id", row.payment_id);
      if (deleteError) throw new Error(deleteError.message);

      const nextPaidAmount = row.paid_amount - row.payment_amount;
      const status = nextPaidAmount >= row.total_amount ? "paid" : nextPaidAmount > 0 ? "deposit" : "unpaid";
      const { error: statusError } = await supabase
        .from("supplier_transactions")
        .update({ payment_status: status })
        .eq("id", row.id);
      if (statusError) throw new Error(statusError.message);

      setMessage("Payment deleted successfully.");
      await loadRows();
    } catch (err: any) {
      setError(err.message || "Failed to delete payment.");
    } finally {
      setLoading(false);
    }
  }

  function buildRemarks() {
    const parts = [];
    if (form.sales_person.trim()) {
      parts.push(`Sales: ${form.sales_person.trim()}`);
    }
    if (form.term.trim()) {
      parts.push(`Term: ${form.term.trim()}`);
    }
    return parts.join(" | ");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (activeTab === "sales") {
      await saveSalesPayments();
    } else if (activeTab === "graba") {
      await saveGrabaPayments();
    } else {
      await saveSupplierPayments();
    }
  }

  async function saveSalesPayments() {
    if (!isSupabaseConfigured) {
      setError("Supabase credentials are missing.");
      return;
    }

    setError("");
    setPaymentDateError("");
    setSalesFieldError("");
    setCkNumberError("");
    setEditAmountError("");

    let hasFieldError = false;
    if (!form.payment_date) {
      setPaymentDateError("Payment Date is required.");
      hasFieldError = true;
    }
    if (!form.sales_person.trim()) {
      setSalesFieldError("Sales Person is required.");
      hasFieldError = true;
    }
    if (isCKMethod(form.payment_method) && !form.ck_number.trim()) {
      setCkNumberError("CK No is required.");
      hasFieldError = true;
    }
    if (editingPayment && Number(form.edit_amount || 0) <= 0) {
      setEditAmountError("Amount is required.");
      hasFieldError = true;
    }

    if (hasFieldError) return;

    if (!editingPayment && selectedDrafts.length === 0) {
      setError("Select at least one OR to pay.");
      return;
    }
    if (!editingPayment && Number(form.total_amount_paid || 0) <= 0) {
      setError("Total Amount Paid must be greater than 0.");
      return;
    }

    setLoading(true);

    try {
      const remarksVal = buildRemarks();

      if (editingPayment) {
        const amount = Number(form.edit_amount || 0);
        const { error: updateError } = await supabase
          .from("sales_payments")
          .update({
            payment_date: form.payment_date,
            amount,
            payment_method: form.payment_method,
            reference_number: isCKMethod(form.payment_method) ? form.ck_number.trim() : null,
            remarks: remarksVal,
          })
          .eq("id", editingPayment.paymentId);
        if (updateError) throw new Error(updateError.message);

        const nextPaidAmount = editingPayment.paidAmount - editingPayment.oldAmount + amount;
        const status = nextPaidAmount >= editingPayment.totalAmount ? "paid" : nextPaidAmount > 0 ? "deposit" : "unpaid";
        const { error: statusError } = await supabase
          .from("sales_records")
          .update({ payment_status: status })
          .eq("id", editingPayment.saleId);
        if (statusError) throw new Error(statusError.message);

        setMessage("Payment updated successfully.");
        setEditingPayment(null);
        setForm(emptyForm);
        await loadRows();
        return;
      }

      // Batch save
      const userPaidInput = Number(form.total_amount_paid || 0);
      let remainingPaid = userPaidInput;
      const isFullBatchPayment = selectedBalanceTotal > 0 && userPaidInput >= selectedBalanceTotal - 0.01;

      const paymentPayload: {
        sales_record_id: string;
        payment_date: string;
        amount: number;
        payment_method: string;
        reference_number: string | null;
        remarks: string;
      }[] = [];
      const saleUpdates: { id: string; status: "paid" | "deposit" | "unpaid" }[] = [];

      const seenPumpcrete = new Set<number>();

      for (let i = 0; i < selectedDrafts.length; i++) {
        const sale = selectedDrafts[i];
        let paymentForThisSale = 0;

        const hasPumpcrete = sale.pumpcrete && sale.pumpcrete > 0;
        const isPumpcreteSeen = hasPumpcrete && seenPumpcrete.has(sale.pumpcrete);
        if (hasPumpcrete) seenPumpcrete.add(sale.pumpcrete);

        const saleTargetTotal = isPumpcreteSeen
          ? sale.total_amount
          : sale.total_amount + sale.pumpcrete;

        const saleTargetBalance = Math.max(0, saleTargetTotal - sale.paid_amount);

        if (i === selectedDrafts.length - 1) {
          paymentForThisSale = remainingPaid;
        } else {
          paymentForThisSale = Math.min(remainingPaid, saleTargetBalance);
          if (paymentForThisSale < 0) paymentForThisSale = 0;
        }
        remainingPaid -= paymentForThisSale;

        if (paymentForThisSale > 0) {
          paymentPayload.push({
            sales_record_id: sale.id,
            payment_date: form.payment_date,
            amount: paymentForThisSale,
            payment_method: form.payment_method,
            reference_number: isCKMethod(form.payment_method) ? form.ck_number.trim() : null,
            remarks: remarksVal,
          });
        }

        const nextPaidAmount = sale.paid_amount + paymentForThisSale;
        const status = isFullBatchPayment || nextPaidAmount >= sale.total_amount
          ? "paid"
          : nextPaidAmount > 0
          ? "deposit"
          : "unpaid";
        saleUpdates.push({ id: sale.id, status });
      }

      if (paymentPayload.length > 0 || saleUpdates.length > 0) {
        if (paymentPayload.length > 0) {
          const { error: insertError } = await supabase.from("sales_payments").insert(paymentPayload);
          if (insertError) throw new Error(insertError.message);
        }

        if (saleUpdates.length > 0) {
          const updateResults = await Promise.all(
            saleUpdates.map((update) =>
              supabase.from("sales_records").update({ payment_status: update.status }).eq("id", update.id)
            )
          );
          for (const res of updateResults) {
            if (res.error) throw new Error(res.error.message);
          }
        }

        setMessage("Payments saved successfully.");
        setSelectedUnpaidRowIds(new Set());
        setForm(emptyForm);
        await loadRows();
      }
    } catch (err: any) {
      setError(err.message || "Failed to save payments.");
    } finally {
      setLoading(false);
    }
  }

  async function saveGrabaPayments() {
    if (!isSupabaseConfigured) {
      setError("Supabase credentials are missing.");
      return;
    }

    setError("");
    setPaymentDateError("");
    setCkNumberError("");
    setEditAmountError("");

    let hasFieldError = false;
    if (!form.payment_date) {
      setPaymentDateError("Payment Date is required.");
      hasFieldError = true;
    }
    if (isCKMethod(form.payment_method) && !form.ck_number.trim()) {
      setCkNumberError("CK No is required.");
      hasFieldError = true;
    }
    if (editingGrabaPayment && Number(form.edit_amount || 0) <= 0) {
      setEditAmountError("Amount is required.");
      hasFieldError = true;
    }

    if (hasFieldError) return;

    if (!editingGrabaPayment && selectedGrabaDrafts.length === 0) {
      setError("Select at least one DR to pay.");
      return;
    }
    if (!editingGrabaPayment && Number(form.total_amount_paid || 0) <= 0) {
      setError("Total Amount Paid must be greater than 0.");
      return;
    }

    setLoading(true);

    try {
      if (editingGrabaPayment) {
        const amount = Number(form.edit_amount || 0);
        const { error: updateError } = await supabase
          .from("graba_payments")
          .update({
            payment_date: form.payment_date,
            amount,
            payment_method: form.payment_method,
            reference_number: isCKMethod(form.payment_method) ? form.ck_number.trim() : null,
            remarks: null,
          })
          .eq("id", editingGrabaPayment.paymentId);
        if (updateError) throw new Error(updateError.message);

        const nextPaidAmount = editingGrabaPayment.paidAmount - editingGrabaPayment.oldAmount + amount;
        const status = nextPaidAmount >= editingGrabaPayment.totalAmount ? "paid" : nextPaidAmount > 0 ? "deposit" : "unpaid";
        const { error: statusError } = await supabase
          .from("graba_records")
          .update({ payment_status: status })
          .eq("id", editingGrabaPayment.grabaRecordId);
        if (statusError) throw new Error(statusError.message);

        setMessage("Graba payment updated successfully.");
        setEditingGrabaPayment(null);
        setForm(emptyForm);
        await loadRows();
        return;
      }

      // Batch save for Graba
      let remainingPaid = Number(form.total_amount_paid || 0);
      const paymentPayload = [];
      const grabaUpdates = [];

      for (let i = 0; i < selectedGrabaDrafts.length; i++) {
        const g = selectedGrabaDrafts[i];
        let paymentForThisGraba = 0;

        if (i === selectedGrabaDrafts.length - 1) {
          paymentForThisGraba = remainingPaid;
        } else {
          paymentForThisGraba = Math.min(remainingPaid, g.balance_amount);
          if (paymentForThisGraba < 0) paymentForThisGraba = 0;
        }
        remainingPaid -= paymentForThisGraba;

        if (paymentForThisGraba > 0) {
          paymentPayload.push({
            graba_record_id: g.id,
            payment_date: form.payment_date,
            amount: paymentForThisGraba,
            payment_method: form.payment_method,
            reference_number: isCKMethod(form.payment_method) ? form.ck_number.trim() : null,
            remarks: null,
          });

          const nextPaidAmount = g.paid_amount + paymentForThisGraba;
          const status = nextPaidAmount >= g.total_amount ? "paid" : "deposit";
          grabaUpdates.push({ id: g.id, status });
        }
      }

      if (paymentPayload.length > 0) {
        const { error: insertError } = await supabase.from("graba_payments").insert(paymentPayload);
        if (insertError) throw new Error(insertError.message);

        for (const update of grabaUpdates) {
          await supabase.from("graba_records").update({ payment_status: update.status }).eq("id", update.id);
        }

        setMessage("Graba payments saved successfully.");
        setSelectedUnpaidGrabaRowIds(new Set());
        setForm(emptyForm);
        await loadRows();
      }
    } catch (err: any) {
      setError(err.message || "Failed to save Graba payments.");
    } finally {
      setLoading(false);
    }
  }

  async function saveSupplierPayments() {
    if (!isSupabaseConfigured) {
      setError("Supabase credentials are missing.");
      return;
    }

    setError("");
    setPaymentDateError("");
    setEditAmountError("");

    let hasFieldError = false;
    if (!form.payment_date) {
      setPaymentDateError("Payment Date is required.");
      hasFieldError = true;
    }
    if (editingSupplierPayment && Number(form.edit_amount || 0) <= 0) {
      setEditAmountError("Amount is required.");
      hasFieldError = true;
    }

    if (hasFieldError) return;

    if (!editingSupplierPayment && selectedSupplierDrafts.length === 0) {
      setError("Select at least one transaction to pay.");
      return;
    }
    if (!editingSupplierPayment && Number(form.total_amount_paid || 0) <= 0) {
      setError("Total Amount Paid must be greater than 0.");
      return;
    }

    setLoading(true);

    try {
      if (editingSupplierPayment) {
        const amount = Number(form.edit_amount || 0);
        const { error: updateError } = await supabase
          .from("supplier_payments")
          .update({
            payment_date: form.payment_date,
            amount,
            ck_number: form.ck_number.trim() || null,
            po_number: form.po_number.trim() || null,
            remarks: form.remarks,
          })
          .eq("id", editingSupplierPayment.paymentId);
        if (updateError) throw new Error(updateError.message);

        const nextPaidAmount = editingSupplierPayment.paidAmount - editingSupplierPayment.oldAmount + amount;
        const status = nextPaidAmount >= editingSupplierPayment.totalAmount ? "paid" : nextPaidAmount > 0 ? "deposit" : "unpaid";
        const { error: statusError } = await supabase
          .from("supplier_transactions")
          .update({ payment_status: status })
          .eq("id", editingSupplierPayment.supplierTransactionId);
        if (statusError) throw new Error(statusError.message);

        setMessage("Payment updated successfully.");
        setEditingSupplierPayment(null);
        setForm(emptyForm);
        await loadRows();
        return;
      }

      // Batch save for Supplier
      let remainingPaid = Number(form.total_amount_paid || 0);
      const paymentPayload = [];
      const supplierUpdates = [];

      for (let i = 0; i < selectedSupplierDrafts.length; i++) {
        const s = selectedSupplierDrafts[i];
        let paymentForThisSupplier = 0;

        if (i === selectedSupplierDrafts.length - 1) {
          paymentForThisSupplier = remainingPaid;
        } else {
          paymentForThisSupplier = Math.min(remainingPaid, s.balance_amount);
          if (paymentForThisSupplier < 0) paymentForThisSupplier = 0;
        }
        remainingPaid -= paymentForThisSupplier;

        if (paymentForThisSupplier > 0) {
          paymentPayload.push({
            supplier_transaction_id: s.id,
            payment_date: form.payment_date,
            amount: paymentForThisSupplier,
            ck_number: form.ck_number.trim() || null,
            po_number: form.po_number.trim() || null,
            remarks: form.remarks,
          });

          const nextPaidAmount = s.paid_amount + paymentForThisSupplier;
          const status = nextPaidAmount >= s.total_amount ? "paid" : "deposit";
          supplierUpdates.push({ id: s.id, status });
        }
      }

      if (paymentPayload.length > 0) {
        const { error: insertError } = await supabase.from("supplier_payments").insert(paymentPayload);
        if (insertError) throw new Error(insertError.message);

        for (const update of supplierUpdates) {
          await supabase.from("supplier_transactions").update({ payment_status: update.status }).eq("id", update.id);
        }

        setMessage("Supplier payments saved successfully.");
        setSelectedUnpaidSupplierRowIds(new Set());
        setForm(emptyForm);
        await loadRows();
      }
    } catch (err: any) {
      setError(err.message || "Failed to save payments.");
    } finally {
      setLoading(false);
    }
  }

  function handleUnpaidSelectionChange(nextSelected: Set<string | number>) {
    setSelectedUnpaidRowIds(nextSelected);
  }

  function handleUnpaidGrabaSelectionChange(nextSelected: Set<string | number>) {
    setSelectedUnpaidGrabaRowIds(nextSelected);
  }

  function handleUnpaidSupplierSelectionChange(nextSelected: Set<string | number>) {
    setSelectedUnpaidSupplierRowIds(nextSelected);
  }

  function renderUnpaidCell(row: PayableSale, column: ExcelColumn<PayableSale>) {
    if (column.key === "balance_amount") {
      return (
        <div className="cell-right" style={{ fontWeight: 600, color: "#f87171" }}>
          {displayMoney(row.balance_amount)}
        </div>
      );
    }
    return undefined;
  }

  function renderUnpaidGrabaCell(row: PayableGraba, column: ExcelColumn<PayableGraba>) {
    if (column.key === "balance_amount") {
      return (
        <div className="cell-right" style={{ fontWeight: 600, color: "#f87171" }}>
          {displayMoney(row.balance_amount)}
        </div>
      );
    }
    return undefined;
  }

  function renderPaidGrabaCell(row: PaidGraba, column: ExcelColumn<PaidGraba>) {
    if (column.key === "payment_amount") {
      return (
        <div className="cell-right" style={{ fontWeight: 600, color: "#34d399" }}>
          {displayMoney(row.payment_amount)}
        </div>
      );
    }
    return undefined;
  }

  useEffect(() => {
    void loadRows();
  }, []);

  useEffect(() => {
    if (activeTab === "graba" && !editingGrabaPayment) {
      setForm((current) => ({
        ...current,
        total_amount_paid: selectedGrabaBalanceTotal || "",
      }));
    }
  }, [selectedGrabaBalanceTotal, activeTab, editingGrabaPayment]);

  useEffect(() => {
    if (activeTab === "sales" && !editingPayment) {
      setForm((current) => ({
        ...current,
        total_amount_paid: selectedBalanceTotal || "",
      }));
    }
  }, [selectedBalanceTotal, activeTab, editingPayment]);

  useEffect(() => {
    if (activeTab === "supplier" && !editingSupplierPayment) {
      setForm((current) => ({
        ...current,
        total_amount_paid: selectedSupplierBalanceTotal || "",
      }));
    }
  }, [selectedSupplierBalanceTotal, activeTab, editingSupplierPayment]);

  const activeEditing = activeTab === "sales" ? editingPayment : activeTab === "graba" ? editingGrabaPayment : editingSupplierPayment;
  const currentBalanceTotal = activeTab === "sales" ? selectedBalanceTotal : activeTab === "graba" ? selectedGrabaBalanceTotal : selectedSupplierBalanceTotal;
  const currentSelectedCount = activeTab === "sales" ? selectedDrafts.length : activeTab === "graba" ? selectedGrabaDrafts.length : selectedSupplierDrafts.length;

  return (
    <Stack gap="md">
      {/* Tab Switcher */}
      <Group justify="space-between" align="center">
        <SegmentedControl
          value={activeTab}
          onChange={(val) => {
            setActiveTab(val as "sales" | "graba" | "supplier");
            cancelEditPayment();
          }}
          data={[
            { label: "Sales Payments", value: "sales" },
            { label: "Graba Payments", value: "graba" },
            { label: "Supplier Payments", value: "supplier" },
          ]}
          size="md"
        />
        <Badge variant="dot" size="lg" color={isSupabaseConfigured ? "green" : "yellow"}>
          {isSupabaseConfigured ? "Live DB" : "Demo Mode"}
        </Badge>
      </Group>

      {/* Form Area */}
      <Paper
        withBorder
        p="md"
        className="masterPanel"
      >
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
              <DateShortcutInput
                label="Payment Date"
                value={form.payment_date}
                error={paymentDateError}
                onChange={(val) => {
                  setPaymentDateError("");
                  setForm((current) => ({ ...current, payment_date: val }));
                }}
              />

              {activeTab !== "supplier" && (
                <Select
                  label="Method"
                  checkIconPosition="right"
                  data={paymentMethods}
                  value={form.payment_method}
                  onChange={(val) =>
                    setForm((current) => ({
                      ...current,
                      payment_method: (val as PaymentMethod) || "Cash",
                    }))
                  }
                />
              )}

              {activeTab === "sales" && (
                <>
                  <SuggestionTextInput
                    label="Sales"
                    value={form.sales_person}
                    error={salesFieldError}
                    suggestions={salesPeople.map((person) => person.label)}
                    onValueChange={(value) => {
                      setSalesFieldError("");
                      setForm((current) => ({ ...current, sales_person: value }));
                    }}
                  />
                  <TextInput
                    label="Term"
                    placeholder="Optional details"
                    value={form.term}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, term: event.currentTarget.value }))
                    }
                  />
                </>
              )}

              {activeTab === "supplier" && (
                <>
                  <TextInput
                    label="CK Number"
                    placeholder="Cheque reference no."
                    value={form.ck_number}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, ck_number: event.currentTarget.value }))
                    }
                  />
                  <TextInput
                    label="PO No"
                    placeholder="PO number"
                    value={form.po_number}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, po_number: event.currentTarget.value }))
                    }
                  />
                  <Select
                    label="Remarks"
                    checkIconPosition="right"
                    data={["Paid", "Collect"]}
                    value={form.remarks}
                    onChange={(val) =>
                      setForm((current) => ({ ...current, remarks: val ?? "Paid" }))
                    }
                  />
                </>
              )}

              {activeTab !== "supplier" && isCKMethod(form.payment_method) && (
                <TextInput
                  label="CK No"
                  value={form.ck_number}
                  error={ckNumberError}
                  onChange={(event) => {
                    setCkNumberError("");
                    setForm((current) => ({ ...current, ck_number: event.currentTarget.value }));
                  }}
                />
              )}

              {activeEditing && (
                <NumberInput
                  label="Amount"
                  min={0}
                  value={form.edit_amount}
                  error={editAmountError}
                  onChange={(value) => {
                    setEditAmountError("");
                    setForm((current) => ({ ...current, edit_amount: Number(value) || "" }));
                  }}
                />
              )}

              {!activeEditing && (
                <Stack gap={4}>
                  <NumberInput
                    label="Total Amount Paid"
                    min={0}
                    value={form.total_amount_paid}
                    onChange={(value) => {
                      setForm((current) => ({ ...current, total_amount_paid: Number(value) || "" }));
                    }}
                  />
                  {activeTab === "sales" && selectedDrafts.length > 0 && (
                    <Text size="xs" c="dimmed">
                      Total Amount: {formatMoney(selectedConcreteTotal)}
                      {selectedPumpcreteTotal > 0 && ` + Pumpcrete: ${formatMoney(selectedPumpcreteTotal)}`}
                      {" = Total: "}{formatMoney(selectedBalanceTotal)}
                    </Text>
                  )}
                </Stack>
              )}
            </SimpleGrid>

            <Group justify="space-between">
              <Group>
                <Button
                  leftSection={<Save size={16} />}
                  type="submit"
                  loading={loading}
                >
                  {activeEditing ? "Save Changes" : "Save Payments"}
                </Button>
                {activeEditing && (
                  <Button
                    type="button"
                    variant="light"
                    color="gray"
                    onClick={cancelEditPayment}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                )}
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
              {currentSelectedCount > 0 && (
                <Badge variant="light" size="lg">
                  Selected Count: {currentSelectedCount} | Remaining Bal: {formatMoney(currentBalanceTotal)}
                </Badge>
              )}
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

      {/* Main Billing Table Grids */}
      {activeTab === "sales" && (
        <Stack gap="xl">
          <Stack gap="xs">
            <Group justify="space-between" align="center" wrap="wrap" gap="xs">
              <Text size="lg" fw={600}>Unpaid OR Transactions</Text>
              <Group gap="xs">
                <MultiSelect
                  placeholder="Filter by Date(s)..."
                  data={availableUnpaidDates}
                  value={selectedUnpaidDates}
                  onChange={setSelectedUnpaidDates}
                  clearable
                  searchable
                  checkIconPosition="right"
                  style={{ minWidth: 220 }}
                />
                <TextInput
                  placeholder="Search Client..."
                  value={unpaidSearch}
                  onChange={(e) => setUnpaidSearch(e.currentTarget.value)}
                  style={{ width: 200 }}
                />
              </Group>
            </Group>
            <CustomExcelTable
              columns={unpaidColumns}
              data={filteredPayableSales}
              withSelection
              checkedRowIds={selectedUnpaidRowIds}
              onCheckedRowIdsChange={handleUnpaidSelectionChange}
              renderCell={renderUnpaidCell}
            />
          </Stack>

          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="lg" fw={600}>Paid History</Text>
              <TextInput
                placeholder="Search Client..."
                value={paidSearch}
                onChange={(e) => setPaidSearch(e.currentTarget.value)}
                style={{ width: 220 }}
              />
            </Group>
            <CustomExcelTable
              columns={paidColumns}
              data={filteredPaidSales}
              onEditClick={(row) => startEditSalesPayment(row)}
              onDeleteClick={(row) => deleteSalesPayment(row)}
              renderRowActions={(row) => (
                <Group gap="xs" justify="center">
                  <Button
                    size="xs"
                    variant="subtle"
                    leftSection={<Edit3 size={14} />}
                    onClick={() => startEditSalesPayment(row)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="xs"
                    variant="subtle"
                    color="red"
                    leftSection={<Trash2 size={14} />}
                    onClick={() => deleteSalesPayment(row)}
                  >
                    Delete
                  </Button>
                </Group>
              )}
            />
          </Stack>
        </Stack>
      )}

      {activeTab === "graba" && (
        <Stack gap="xl">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="lg" fw={600}>Unpaid Graba Records</Text>
              <TextInput
                placeholder="Search Supplier/DR..."
                value={unpaidGrabaSearch}
                onChange={(e) => setUnpaidGrabaSearch(e.currentTarget.value)}
                style={{ width: 220 }}
              />
            </Group>
            <CustomExcelTable
              columns={unpaidGrabaColumns}
              data={filteredPayableGraba}
              withSelection
              checkedRowIds={selectedUnpaidGrabaRowIds}
              onCheckedRowIdsChange={handleUnpaidGrabaSelectionChange}
              renderCell={renderUnpaidGrabaCell}
            />
          </Stack>

          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="lg" fw={600}>Paid History</Text>
              <TextInput
                placeholder="Search Supplier/DR..."
                value={paidGrabaSearch}
                onChange={(e) => setPaidGrabaSearch(e.currentTarget.value)}
                style={{ width: 220 }}
              />
            </Group>
            <CustomExcelTable
              columns={paidGrabaColumns}
              data={filteredPaidGraba}
              onEditClick={(row) => startEditGrabaPayment(row)}
              onDeleteClick={(row) => deleteGrabaPayment(row)}
              renderCell={renderPaidGrabaCell}
              renderRowActions={(row) => (
                <Group gap="xs" justify="center">
                  <Button
                    size="xs"
                    variant="subtle"
                    leftSection={<Edit3 size={14} />}
                    onClick={() => startEditGrabaPayment(row)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="xs"
                    variant="subtle"
                    color="red"
                    leftSection={<Trash2 size={14} />}
                    onClick={() => deleteGrabaPayment(row)}
                  >
                    Delete
                  </Button>
                </Group>
              )}
            />
          </Stack>
        </Stack>
      )}

      {activeTab === "supplier" && (
        <Stack gap="xl">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="lg" fw={600}>Unpaid Supplier Transactions</Text>
              <TextInput
                placeholder="Search Supplier/DR..."
                value={unpaidSupplierSearch}
                onChange={(e) => setUnpaidSupplierSearch(e.currentTarget.value)}
                style={{ width: 220 }}
              />
            </Group>
            <CustomExcelTable
              columns={unpaidSupplierColumns}
              data={filteredPayableSupplier}
              withSelection
              checkedRowIds={selectedUnpaidSupplierRowIds}
              onCheckedRowIdsChange={handleUnpaidSupplierSelectionChange}
              renderCell={(row, col) => {
                if (col.key === "balance_amount") {
                  return (
                    <div className="cell-right" style={{ fontWeight: 600, color: "#f87171" }}>
                      {displayMoney(row.balance_amount)}
                    </div>
                  );
                }
                return undefined;
              }}
            />
          </Stack>

          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="lg" fw={600}>Paid History</Text>
              <TextInput
                placeholder="Search Supplier/DR..."
                value={paidSupplierSearch}
                onChange={(e) => setPaidSupplierSearch(e.currentTarget.value)}
                style={{ width: 220 }}
              />
            </Group>
            <CustomExcelTable
              columns={paidSupplierColumns}
              data={filteredPaidSupplier}
              onEditClick={(row) => startEditSupplierPayment(row)}
              onDeleteClick={(row) => deleteSupplierPayment(row)}
              renderCell={(row, col) => {
                if (col.key === "payment_amount") {
                  return (
                    <div className="cell-right" style={{ fontWeight: 600, color: "#34d399" }}>
                      {displayMoney(row.payment_amount)}
                    </div>
                  );
                }
                return undefined;
              }}
              renderRowActions={(row) => (
                <Group gap="xs" justify="center">
                  <Button
                    size="xs"
                    variant="subtle"
                    leftSection={<Edit3 size={14} />}
                    onClick={() => startEditSupplierPayment(row)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="xs"
                    variant="subtle"
                    color="red"
                    leftSection={<Trash2 size={14} />}
                    onClick={() => deleteSupplierPayment(row)}
                  >
                    Delete
                  </Button>
                </Group>
              )}
            />
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}
