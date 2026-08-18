import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Collapse,
  Divider,
  Group,
  Loader,
  LoadingOverlay,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import {
  Printer,
  FileText,
  Filter,
  Check,
  CheckSquare,
  Square,
  RefreshCw,
  Settings,
  Building,
  Calendar,
  AlertCircle,
  Download,
  Eye,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { DateShortcutInput } from "../components/DateShortcutInput";
import { useSnackbar } from "../context/SnackbarContext";

type Lookup = {
  id: string;
  label: string;
};

type SoaSaleItem = {
  id: string;
  sale_or_number: number;
  sale_date: string;
  customer_id?: string;
  client_name: string;
  design: string;
  site: string;
  cubic_volume: number;
  unit_price: number;
  pumpcreate: number;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  payment_status: string;
  selected: boolean;
};

type SoaGroup = {
  design: string;
  unit_price: number;
  items: SoaSaleItem[];
  subtotalCubic: number;
  subtotalAmount: number;
};

function formatSoaDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDate();
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function formatSoaHeaderDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function SolidLogo({ height = 60 }: { height?: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <svg
        width={height * 2.8}
        height={height}
        viewBox="0 0 280 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: "visible" }}
      >
        {/* Red swoosh arc */}
        <path
          d="M 50,22 C 60,6 120,2 150,12 C 115,5 75,10 58,24 Z"
          fill="#dc2626"
        />
        {/* Blue swoosh arc */}
        <path
          d="M 36,30 C 30,14 62,0 110,2 C 70,2 40,14 44,32 Z"
          fill="#1d4ed8"
        />
        {/* SOLID text with forward slant */}
        <text
          x="140"
          y="42"
          textAnchor="middle"
          fontSize="36"
          fontWeight="900"
          fontStyle="italic"
          fontFamily="system-ui, -apple-system, sans-serif"
          fill="#1e40af"
          letterSpacing="2"
        >
          SOLID
        </text>
      </svg>
      <div
        style={{
          fontSize: "12px",
          fontWeight: 800,
          color: "#0f172a",
          letterSpacing: "0.5px",
          marginTop: "-2px",
          fontFamily: "Arial, sans-serif",
          textTransform: "uppercase",
        }}
      >
        PHILIPPINES SOLID BATCHING PLANT CORP.
      </div>
    </div>
  );
}

export function ReportsPage() {
  const { showSuccess, showError } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Lookup[]>([]);
  const [salesRecords, setSalesRecords] = useState<SoaSaleItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedSite, setSelectedSite] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("unpaid");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [statementDate, setStatementDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [drSearch, setDrSearch] = useState<string>("");

  // Account & Template Settings
  const [bankName, setBankName] = useState<string>("BDO");
  const [accountName, setAccountName] = useState<string>(
    "PHILIPPINES SOLID BATCHING PLANT CORP",
  );
  const [accountNumber, setAccountNumber] = useState<string>("0063-8801-1263");
  const [customAddress, setCustomAddress] = useState<string>("");
  const [receivedByLabel, setReceivedByLabel] = useState<string>("Received By");
  const [showSettings, setShowSettings] = useState(false);

  // Selected DRs Set
  const [selectedDrIds, setSelectedDrIds] = useState<Set<string>>(new Set());

  // Load Initial Lookups & Sales
  async function loadData() {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    try {
      const [custRes, salesRes] = await Promise.all([
        supabase.from("customers").select("id,name").order("name"),
        supabase
          .from("sales_records")
          .select(
            "id,sale_or_number,sale_date,customer_id,manual_customer_name,project_site,cubic_volume,unit_price,pumpcreate,total_amount,payment_status,customers(id,name),concrete_designs(code,pumpcreate),sales_payments(amount)",
          )
          .order("sale_or_number", { ascending: true })
          .limit(5000),
      ]);

      if (custRes.error) throw new Error(custRes.error.message);
      if (salesRes.error) throw new Error(salesRes.error.message);

      const custList: Lookup[] = (custRes.data ?? []).map((c) => ({
        id: c.id,
        label: c.name,
      }));
      setCustomers(custList);

      const salesList: SoaSaleItem[] = (salesRes.data ?? []).map((r: any) => {
        const custNameFromJoin =
          Array.isArray(r.customers) ? r.customers[0]?.name : r.customers?.name;
        const custNameFromList = r.customer_id
          ? custList.find((c) => c.id === r.customer_id)?.label
          : "";
        const custName =
          custNameFromJoin ||
          custNameFromList ||
          r.manual_customer_name ||
          "Unknown Customer";

        const designCode =
          (Array.isArray(r.concrete_designs)
            ? r.concrete_designs[0]?.code
            : r.concrete_designs?.code) ?? "";
        const pumpVal = Number(r.pumpcreate ?? 0);
        const cubicVal = Number(r.cubic_volume || 0);
        const priceVal = Number(r.unit_price || 0);
        const baseTotal =
          Number(r.total_amount || 0) > 0
            ? Number(r.total_amount)
            : cubicVal * priceVal;
        const fullTotal = baseTotal + pumpVal;

        const paymentsList = Array.isArray(r.sales_payments)
          ? r.sales_payments
          : r.sales_payments
          ? [r.sales_payments]
          : [];
        const paidAmount = paymentsList.reduce(
          (sum: number, p: any) => sum + Number(p?.amount || 0),
          0,
        );

        const rawStatus = (r.payment_status || "unpaid").toLowerCase().trim();
        const isPaidInDb = rawStatus === "paid";
        const isPaidByFullAmount = fullTotal > 0 && paidAmount >= fullTotal;
        const isFullyPaid = isPaidInDb || isPaidByFullAmount;

        const derivedStatus = isFullyPaid
          ? "paid"
          : paidAmount > 0
          ? "deposit"
          : "unpaid";
        const balanceAmount = isFullyPaid ? 0 : Math.max(0, fullTotal - paidAmount);

        const resolvedCustomerId =
          r.customer_id ||
          custList.find(
            (c) => c.label.toLowerCase().trim() === custName.toLowerCase().trim(),
          )?.id ||
          undefined;

        return {
          id: r.id,
          sale_or_number: Number(r.sale_or_number || 0),
          sale_date: r.sale_date,
          customer_id: resolvedCustomerId,
          client_name: custName,
          design: designCode || "STANDARD",
          site: (r.project_site ?? "").trim(),
          cubic_volume: cubicVal,
          unit_price: priceVal,
          pumpcreate: pumpVal,
          total_amount: fullTotal,
          paid_amount: paidAmount,
          balance_amount: balanceAmount,
          payment_status: derivedStatus,
          selected: true,
        };
      });

      setSalesRecords(salesList);
    } catch (err: any) {
      showError(err.message || "Failed to load records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  // Combined Customer Options for Select dropdown (No "All Clients")
  const customerOptions = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach((c) => {
      if (c.id && c.label) map.set(c.id, c.label);
    });
    salesRecords.forEach((s) => {
      if (s.customer_id && s.client_name) {
        map.set(s.customer_id, s.client_name);
      }
    });

    const opts = Array.from(map.entries()).map(([id, label]) => ({
      value: id,
      label,
    }));
    opts.sort((a, b) => a.label.localeCompare(b.label));

    return opts;
  }, [customers, salesRecords]);

  // Selected Customer Details
  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    const fromCust = customers.find((c) => c.id === selectedCustomerId);
    if (fromCust) return fromCust;
    const fromOpts = customerOptions.find((c) => c.value === selectedCustomerId);
    if (fromOpts) return { id: fromOpts.value, label: fromOpts.label };
    return null;
  }, [customers, customerOptions, selectedCustomerId]);

  // Available Sites for this Customer
  const availableSites = useMemo(() => {
    if (!selectedCustomer) return [];
    const list = salesRecords.filter(
      (s) =>
        (s.customer_id && s.customer_id === selectedCustomer.id) ||
        (s.client_name && s.client_name.toLowerCase().trim() === selectedCustomer.label.toLowerCase().trim()),
    );
    const setOfSites = new Set(list.map((s) => s.site).filter(Boolean));
    return Array.from(setOfSites).sort();
  }, [salesRecords, selectedCustomer]);

  // Filtered Sales for the Statement (Requires selectedCustomer)
  const matchingSales = useMemo(() => {
    if (!selectedCustomerId || !selectedCustomer) return [];

    return salesRecords.filter((sale) => {
      // Must match chosen customer
      const matchCustId = sale.customer_id === selectedCustomerId;
      const matchCustName =
        sale.client_name.toLowerCase().trim() === selectedCustomer.label.toLowerCase().trim();
      if (!matchCustId && !matchCustName) return false;

      // Site Filter
      if (selectedSite && selectedSite !== "all") {
        if (sale.site.trim().toLowerCase() !== selectedSite.trim().toLowerCase()) {
          return false;
        }
      }

      // Status Filter
      const status = (sale.payment_status || "unpaid").toLowerCase();
      if (selectedStatus === "unpaid") {
        if (status === "paid") return false;
      } else if (selectedStatus === "paid") {
        if (status !== "paid") return false;
      }

      // Date Range Filter (Normalized YYYY-MM-DD comparison)
      const saleDateStr = (sale.sale_date || "").slice(0, 10);
      if (fromDate && fromDate.trim()) {
        const normFrom = fromDate.trim().slice(0, 10);
        if (saleDateStr && saleDateStr < normFrom) return false;
      }
      if (toDate && toDate.trim()) {
        const normTo = toDate.trim().slice(0, 10);
        if (saleDateStr && saleDateStr > normTo) return false;
      }

      // DR Search Filter
      if (drSearch.trim()) {
        const q = drSearch.trim();
        const matchDr = String(sale.sale_or_number).includes(q);
        if (!matchDr) return false;
      }

      return true;
    });
  }, [
    salesRecords,
    selectedCustomerId,
    selectedCustomer,
    selectedSite,
    selectedStatus,
    fromDate,
    toDate,
    drSearch,
  ]);

  // Synchronize selection when matching items change
  useEffect(() => {
    const ids = new Set(matchingSales.map((s) => s.id));
    setSelectedDrIds(ids);
  }, [selectedCustomerId, selectedSite, selectedStatus, fromDate, toDate, drSearch]);

  // Active items included in the SOA
  const activeSoaItems = useMemo(() => {
    return matchingSales.filter((sale) => selectedDrIds.has(sale.id));
  }, [matchingSales, selectedDrIds]);

  // Group items by Concrete Design (and unit price)
  const groupedSoaData = useMemo(() => {
    const groupMap = new Map<string, SoaGroup>();

    // Sort active items by design, then date, then DR
    const sorted = [...activeSoaItems].sort((a, b) => {
      if (a.design !== b.design) return a.design.localeCompare(b.design);
      if (a.sale_date !== b.sale_date) return a.sale_date.localeCompare(b.sale_date);
      return a.sale_or_number - b.sale_or_number;
    });

    for (const item of sorted) {
      const key = `${item.design}__${item.unit_price}`;
      let group = groupMap.get(key);
      if (!group) {
        group = {
          design: item.design,
          unit_price: item.unit_price,
          items: [],
          subtotalCubic: 0,
          subtotalAmount: 0,
        };
        groupMap.set(key, group);
      }
      group.items.push(item);
      group.subtotalCubic += item.cubic_volume;
      group.subtotalAmount += item.cubic_volume * item.unit_price + item.pumpcreate;
    }

    return Array.from(groupMap.values());
  }, [activeSoaItems]);

  // Grand Total Calculation
  const grandTotalAmount = useMemo(() => {
    return groupedSoaData.reduce((sum, g) => sum + g.subtotalAmount, 0);
  }, [groupedSoaData]);

  const grandTotalCubic = useMemo(() => {
    return groupedSoaData.reduce((sum, g) => sum + g.subtotalCubic, 0);
  }, [groupedSoaData]);

  // Display Client Name & Address for Header
  const displayClientName = useMemo(() => {
    if (selectedCustomer) return selectedCustomer.label;
    return "____________________";
  }, [selectedCustomer]);

  // Display Address
  const displayAddress = useMemo(() => {
    if (customAddress.trim()) return customAddress.trim();
    if (selectedSite !== "all") return selectedSite;
    if (availableSites.length > 0) return availableSites.join(", ");
    return "-";
  }, [customAddress, selectedSite, availableSites]);

  // Handle Print Action
  const handlePrint = () => {
    if (!selectedCustomerId) {
      showError("Please select a client first to print the Statement of Account.");
      return;
    }
    if (activeSoaItems.length === 0) {
      showError("No delivery receipt records selected to print.");
      return;
    }
    window.print();
  };

  const handleToggleSelectAll = () => {
    if (selectedDrIds.size === matchingSales.length) {
      setSelectedDrIds(new Set());
    } else {
      setSelectedDrIds(new Set(matchingSales.map((s) => s.id)));
    }
  };

  return (
    <Stack gap="lg">
      {/* Top Header Controls (Hidden on Print) */}
      <Paper p="md" radius="sm" className="no-print soa-controls-panel" withBorder style={{ backgroundColor: "#111827", borderColor: "rgba(255,255,255,0.08)" }}>
        <Stack gap="md">
          <Group justify="space-between" align="center" wrap="wrap">
            <Group gap="sm">
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: "rgba(37,99,235,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#60a5fa",
                }}
              >
                <FileText size={20} />
              </div>
              <div>
                <Title order={3} style={{ color: "#f8fafc", fontSize: 18 }}>
                  Statement of Account (SOA) Generator
                </Title>
                <Text size="xs" c="dimmed">
                  Generate, preview, and print official billing statements matching company format.
                </Text>
              </div>
            </Group>

            <Group gap="xs">
              <Button
                variant="light"
                color="gray"
                size="sm"
                leftSection={<Settings size={15} />}
                onClick={() => setShowSettings(!showSettings)}
              >
                Account Settings
              </Button>
              <Button
                variant="light"
                color="blue"
                size="sm"
                leftSection={<RefreshCw size={15} />}
                onClick={loadData}
                loading={loading}
              >
                Refresh
              </Button>
              <Button
                color="green"
                size="sm"
                leftSection={<Printer size={16} />}
                onClick={handlePrint}
                disabled={!selectedCustomerId || activeSoaItems.length === 0}
              >
                Print / Save to PDF
              </Button>
            </Group>
          </Group>

          <Divider color="rgba(255,255,255,0.08)" />

          {/* Main Filter Inputs */}
          <SimpleGrid cols={{ base: 1, sm: 2, md: 5 }} spacing="sm">
            <Select
              label="Select Client / Bill To"
              placeholder="Choose Client (Required)..."
              data={customerOptions}
              value={selectedCustomerId}
              onChange={(val) => {
                setSelectedCustomerId(val);
                setSelectedSite("all");
              }}
              checkIconPosition="right"
              searchable
              clearable={false}
              required
              comboboxProps={{ withinPortal: true, zIndex: 10000 }}
            />

            <Select
              label="Project Site"
              placeholder={availableSites.length > 0 ? "All Sites" : "No sites for this client"}
              data={[
                { value: "all", label: "All Project Sites" },
                ...availableSites.map((s) => ({ value: s, label: s })),
              ]}
              value={selectedSite}
              onChange={(val) => setSelectedSite(val || "all")}
              checkIconPosition="right"
              searchable
              comboboxProps={{ withinPortal: true, zIndex: 10000 }}
            />

            <Select
              label="Payment Status"
              data={[
                { value: "unpaid", label: "Unpaid" },
                { value: "paid", label: "Paid" },
                { value: "all", label: "All Status" },
              ]}
              value={selectedStatus}
              onChange={(val) => setSelectedStatus(val || "unpaid")}
              checkIconPosition="right"
              comboboxProps={{ withinPortal: true, zIndex: 10000 }}
            />

            <DateShortcutInput
              label="Statement Date"
              value={statementDate}
              onChange={setStatementDate}
            />

            <TextInput
              label="Filter DR No."
              placeholder="Search DR..."
              value={drSearch}
              onChange={(e) => setDrSearch(e.currentTarget.value)}
            />
          </SimpleGrid>

          {/* Date Range & Address Options */}
          <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="sm">
            <DateShortcutInput
              label="From Sale Date"
              placeholder="e.g. 0401 (Optional)"
              value={fromDate}
              onChange={setFromDate}
              clearable
            />
            <DateShortcutInput
              label="To Sale Date"
              placeholder="e.g. 0430 (Optional)"
              value={toDate}
              onChange={setToDate}
              clearable
            />
            <TextInput
              label="Custom Address / Site Override"
              placeholder="e.g. Anyana Tanza"
              value={customAddress}
              onChange={(e) => setCustomAddress(e.currentTarget.value)}
            />
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              {(fromDate || toDate || drSearch || selectedSite !== "all" || selectedStatus !== "unpaid" || customAddress) && (
                <Button
                  variant="subtle"
                  color="red"
                  size="sm"
                  fullWidth
                  onClick={() => {
                    setFromDate("");
                    setToDate("");
                    setDrSearch("");
                    setSelectedSite("all");
                    setSelectedStatus("unpaid");
                    setCustomAddress("");
                  }}
                >
                  Reset All Filters
                </Button>
              )}
            </div>
          </SimpleGrid>

          {/* Collapsible Account Settings */}
          <Collapse in={showSettings}>
            <Paper p="sm" radius="xs" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Text size="xs" fw={700} c="blue.4" mb="xs">
                Bank & Statement Details (Printed on Document Footer)
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="sm">
                <TextInput
                  label="Bank Name"
                  value={bankName}
                  onChange={(e) => setBankName(e.currentTarget.value)}
                />
                <TextInput
                  label="Account Name"
                  value={accountName}
                  onChange={(e) => setAccountName(e.currentTarget.value)}
                />
                <TextInput
                  label="Account Number"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.currentTarget.value)}
                />
                <TextInput
                  label="Signatory Label"
                  value={receivedByLabel}
                  onChange={(e) => setReceivedByLabel(e.currentTarget.value)}
                />
              </SimpleGrid>
            </Paper>
          </Collapse>
        </Stack>
      </Paper>

      {/* DRs Selector Drawer / Box (Hidden on Print) */}
      <Paper p="sm" radius="sm" className="no-print" withBorder style={{ backgroundColor: "#111827", borderColor: "rgba(255,255,255,0.08)" }}>
        <Group justify="space-between" align="center" mb="xs">
          <Group gap="xs">
            <Text size="sm" fw={600} c="gray.3">
              Included Deliveries ({activeSoaItems.length} of {matchingSales.length} DRs selected)
            </Text>
            <Button
              size="compact-xs"
              variant="light"
              color={selectedDrIds.size === matchingSales.length ? "yellow" : "blue"}
              rightSection={
                selectedDrIds.size === matchingSales.length ? (
                  <Square size={12} />
                ) : (
                  <Check size={12} />
                )
              }
              onClick={handleToggleSelectAll}
              disabled={matchingSales.length === 0}
            >
              {selectedDrIds.size === matchingSales.length ? "Deselect All" : "Select All"}
            </Button>
          </Group>
          <Text size="xs" c="dimmed">
            Total Cubic: <strong style={{ color: "#60a5fa" }}>{grandTotalCubic.toFixed(1)}</strong> | Amount: <strong style={{ color: "#34d399" }}>₱{grandTotalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
          </Text>
        </Group>

        {!selectedCustomerId ? (
          <Alert icon={<Building size={16} />} color="blue" variant="light">
            Please select a client from the "Select Client / Bill To" dropdown above to view and include their delivery receipts.
          </Alert>
        ) : matchingSales.length === 0 ? (
          <Alert icon={<AlertCircle size={14} />} color="yellow" variant="light">
            No delivery records found for <strong>{selectedCustomer?.label}</strong> matching the current filters.
          </Alert>
        ) : (
          <div style={{ maxHeight: 140, overflowY: "auto" }}>
            <Group gap="xs">
              {matchingSales.map((sale) => {
                const isSelected = selectedDrIds.has(sale.id);
                return (
                  <Badge
                    key={sale.id}
                    size="md"
                    variant={isSelected ? "filled" : "outline"}
                    color={isSelected ? "blue" : "gray"}
                    rightSection={
                      isSelected ? (
                        <Check size={12} strokeWidth={2.5} style={{ marginLeft: 4 }} />
                      ) : undefined
                    }
                    style={{ cursor: "pointer", userSelect: "none" }}
                    onClick={() => {
                      const next = new Set(selectedDrIds);
                      if (isSelected) next.delete(sale.id);
                      else next.add(sale.id);
                      setSelectedDrIds(next);
                    }}
                  >
                    DR {sale.sale_or_number} ({sale.cubic_volume}m³)
                  </Badge>
                );
              })}
            </Group>
          </div>
        )}
      </Paper>

      {/* =========================================================================
          AUTHENTIC STATEMENT OF ACCOUNT DOCUMENT (Print & Screen View)
          ========================================================================= */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          width: "100%",
          paddingBottom: "40px",
        }}
      >
        <div className="soa-paper-sheet">
          {/* Header Brand Logo */}
          <div style={{ textAlign: "center", marginBottom: "14px" }}>
            <SolidLogo height={52} />
          </div>

          {/* Title */}
          <div
            style={{
              textAlign: "center",
              fontSize: "17px",
              fontWeight: 800,
              letterSpacing: "1px",
              color: "#000000",
              marginBottom: "20px",
              fontFamily: "Arial, sans-serif",
            }}
          >
            STATEMENT OF ACCOUNT
          </div>

          {/* Customer Metadata & Statement Date */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              fontSize: "13px",
              color: "#000000",
              lineHeight: 1.45,
              marginBottom: "16px",
            }}
          >
            <div style={{ maxWidth: "60%" }}>
              <div>
                <strong>BILL TO:</strong> {displayClientName}
              </div>
              <div>
                <strong>ADDRESS:</strong> {displayAddress}
              </div>
            </div>
            <div style={{ textAlign: "right", fontWeight: 700 }}>
              {formatSoaHeaderDate(statementDate)}
            </div>
          </div>

          {/* Summary Label */}
          <div
            style={{
              fontSize: "13.5px",
              fontWeight: 700,
              color: "#000000",
              marginBottom: "4px",
            }}
          >
            Summary:
          </div>

          {/* Main Statement Table */}
          <table className="soa-table">
            <thead>
              <tr>
                <th style={{ width: "18%" }}>DATE</th>
                <th style={{ width: "14%" }}>DR NO.</th>
                <th style={{ width: "28%" }}>DESIGN</th>
                <th style={{ width: "12%" }}>CUBIC</th>
                <th style={{ width: "13%" }}>PRICE</th>
                <th style={{ width: "15%" }}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {groupedSoaData.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "26px 18px", color: "#666" }}>
                    {!selectedCustomerId
                      ? "Please select a client above to generate and view the Statement of Account."
                      : "No delivery receipt items found or selected for this statement."}
                  </td>
                </tr>
              ) : (
                groupedSoaData.map((group, groupIdx) => (
                  <React.Fragment key={`group-${groupIdx}`}>
                    {/* Item Rows */}
                    {group.items.map((item) => (
                      <tr key={item.id}>
                        <td className="center">{formatSoaDate(item.sale_date)}</td>
                        <td className="center">{item.sale_or_number}</td>
                        <td className="center">{item.design}</td>
                        <td className="center">{item.cubic_volume}</td>
                        <td className="right"></td>
                        <td className="right"></td>
                      </tr>
                    ))}

                    {/* Subtotal Row for the Group */}
                    <tr className="subtotal-row">
                      <td className="center"></td>
                      <td className="center"></td>
                      <td className="center"></td>
                      <td className="center">{group.subtotalCubic}</td>
                      <td className="right">
                        {group.unit_price.toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="right">
                        {group.subtotalAmount.toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>

          {/* Grand Total Row */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              marginTop: "8px",
              marginBottom: "32px",
              paddingRight: "8px",
              fontSize: "14px",
              fontWeight: 800,
              color: "#000000",
              gap: "24px",
            }}
          >
            <span>TOTAL AMOUNT:</span>
            <span style={{ minWidth: "120px", textAlign: "right", fontSize: "15px" }}>
              {grandTotalAmount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>

          {/* Footer Account Details & Signatory */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              fontSize: "12px",
              color: "#000000",
              marginTop: "40px",
              paddingTop: "12px",
            }}
          >
            {/* Bank Details */}
            <div style={{ lineHeight: 1.4 }}>
              <div style={{ fontWeight: 800, marginBottom: "2px" }}>ACCOUNT DETAILS:</div>
              <div style={{ display: "flex", gap: "8px" }}>
                <span style={{ width: "105px" }}>Bank</span>
                <span>: <strong>{bankName}</strong></span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <span style={{ width: "105px" }}>Account Name</span>
                <span>: <strong>{accountName}</strong></span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <span style={{ width: "105px" }}>Account Number</span>
                <span>: <strong>{accountNumber}</strong></span>
              </div>
            </div>

            {/* Received By Signature Line */}
            <div style={{ textAlign: "right", minWidth: "220px" }}>
              <span>{receivedByLabel}: </span>
              <span
                style={{
                  display: "inline-block",
                  borderBottom: "1px solid #000000",
                  width: "140px",
                  verticalAlign: "bottom",
                  marginLeft: "4px",
                }}
              >
                &nbsp;
              </span>
            </div>
          </div>
        </div>
      </div>
    </Stack>
  );
}
