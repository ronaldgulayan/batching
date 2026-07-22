import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Badge,
  Button,
  Group,
  Paper,
  Progress,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  AlertCircle,
  CalendarDays,
  CreditCard,
  RefreshCw,
  ReceiptText,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { DateShortcutInput } from "../components/DateShortcutInput";

type PeriodMode = "today" | "range" | "month" | "year";

type SalesSummaryRecord = {
  id: string;
  sale_or_number: number | null;
  sale_date: string;
  customer_name: string | null;
  concrete_design: string | null;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  payment_status: string;
};

type PaymentRecord = {
  id: string;
  sales_record_id: string;
  payment_date: string;
  amount: number;
  payment_method: string | null;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function thisMonth() {
  return today().slice(0, 7);
}

function thisYear() {
  return today().slice(0, 4);
}

function yearOptions() {
  const currentYear = new Date().getFullYear();
  const options: string[] = [];
  for (let y = currentYear; y >= 2000; y--) {
    options.push(String(y));
  }
  return options;
}

function displayDate(value: string) {
  if (!value) return "";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function displayMoney(value: number) {
  return `PHP ${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateInPeriod(date: string, mode: PeriodMode, filters: DashboardFilters) {
  if (!date) return false;
  if (mode === "today") return date === filters.currentDate;
  if (mode === "month") return date.startsWith(filters.month);
  if (mode === "year") return date.startsWith(filters.year);
  return date >= filters.startDate && date <= filters.endDate;
}

function periodLabel(mode: PeriodMode, filters: DashboardFilters) {
  if (mode === "today") return displayDate(filters.currentDate);
  if (mode === "month") return filters.month;
  if (mode === "year") return filters.year;
  return `${displayDate(filters.startDate)} to ${displayDate(filters.endDate)}`;
}

type DashboardFilters = {
  currentDate: string;
  startDate: string;
  endDate: string;
  month: string;
  year: string;
};

type LeaderItem = {
  label: string;
  amount: number;
  count: number;
};

type UnpaidSummaryItem = {
  customer: string;
  unpaidAmount: number;
  records: number;
};

function buildLeaders(
  rows: SalesSummaryRecord[],
  getLabel: (row: SalesSummaryRecord) => string,
) {
  const map = new Map<string, LeaderItem>();

  for (const row of rows) {
    const label = getLabel(row) || "Unspecified";
    const item = map.get(label) ?? { label, amount: 0, count: 0 };
    item.amount += Number(row.total_amount || 0);
    item.count += 1;
    map.set(label, item);
  }

  return Array.from(map.values()).sort((first, second) => {
    if (second.amount !== first.amount) return second.amount - first.amount;
    return first.label.localeCompare(second.label);
  });
}

function sumByMethod(payments: PaymentRecord[]) {
  const map = new Map<string, number>();

  for (const payment of payments) {
    const method = payment.payment_method || "Unspecified";
    map.set(method, (map.get(method) ?? 0) + Number(payment.amount || 0));
  }

  return Array.from(map.entries())
    .map(([method, amount]) => ({ method, amount }))
    .sort((first, second) => second.amount - first.amount);
}

function buildUnpaidSummary(rows: SalesSummaryRecord[]) {
  const map = new Map<string, UnpaidSummaryItem>();

  for (const row of rows) {
    const unpaidAmount = Number(row.balance_amount || 0);
    if (unpaidAmount <= 0) continue;

    const customer = row.customer_name || "Unspecified";
    const item = map.get(customer) ?? { customer, unpaidAmount: 0, records: 0 };
    item.unpaidAmount += unpaidAmount;
    item.records += 1;
    map.set(customer, item);
  }

  return Array.from(map.values()).sort((first, second) => {
    if (second.unpaidAmount !== first.unpaidAmount) {
      return second.unpaidAmount - first.unpaidAmount;
    }
    return first.customer.localeCompare(second.customer);
  });
}

type ClientChequeItem = {
  id: string;
  customer_name: string;
  ck_number: string;
  payment_date: string;
  amount: number;
};

type SupplierUnpaidItem = {
  supplier_name: string;
  unpaidAmount: number;
  records: number;
};

type SupplierChequeItem = {
  id: string;
  supplier_name: string;
  ck_number: string;
  payment_date: string;
  amount: number;
};

export function DashboardPage() {
  const [sales, setSales] = useState<SalesSummaryRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [supplierBilling, setSupplierBilling] = useState<any[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<any[]>([]);
  const [grabaSummary, setGrabaSummary] = useState<any[]>([]);
  const [grabaPayments, setGrabaPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [filters, setFilters] = useState<DashboardFilters>({
    currentDate: today(),
    startDate: today(),
    endDate: today(),
    month: thisMonth(),
    year: thisYear(),
  });

  async function loadDashboard() {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError("");

    const [
      salesResult,
      paymentsResult,
      supplierBillingResult,
      supplierPaymentsResult,
      grabaSummaryResult,
      grabaPaymentsResult,
    ] = await Promise.all([
      supabase
        .from("sales_records")
        .select(
          "id,sale_or_number,sale_date,cubic_volume,unit_price,total_amount,pumpcreate,manual_customer_name,payment_status,customers(name),concrete_designs(code,pumpcreate)",
        )
        .order("sale_date", { ascending: false }),
      supabase
        .from("sales_payments")
        .select("id,sales_record_id,payment_date,amount,payment_method,reference_number,remarks")
        .order("payment_date", { ascending: false }),
      supabase
        .from("supplier_billing_summary")
        .select("id,dr_number,transaction_date,supplier_name,item_name,total_amount,paid_amount,balance_amount,payment_status")
        .order("transaction_date", { ascending: false }),
      supabase
        .from("supplier_payments")
        .select("id,supplier_transaction_id,payment_date,amount,ck_number,remarks")
        .order("payment_date", { ascending: false }),
      supabase
        .from("graba_summary")
        .select("id,graba_dr_number,graba_date,supplier_name,items,total_amount,paid_amount,balance_amount,payment_status")
        .order("graba_date", { ascending: false }),
      supabase
        .from("graba_payments")
        .select("id,graba_record_id,payment_date,amount,payment_method,reference_number,remarks")
        .order("payment_date", { ascending: false }),
    ]);

    setLoading(false);

    if (salesResult.error || paymentsResult.error) {
      setError(salesResult.error?.message || paymentsResult.error?.message || "");
      return;
    }

    const rawSales = (salesResult.data ?? []) as any[];
    const allPaymentsMap = new Map<string, number>();
    for (const p of (paymentsResult.data ?? []) as any[]) {
      const current = allPaymentsMap.get(p.sales_record_id) ?? 0;
      allPaymentsMap.set(p.sales_record_id, current + Number(p.amount || 0));
    }

    const processedSales: SalesSummaryRecord[] = rawSales.map((record) => {
      const custName = Array.isArray(record.customers)
        ? record.customers[0]?.name
        : record.customers?.name;
      const customerName = custName ?? record.manual_customer_name ?? "";

      const designCode = Array.isArray(record.concrete_designs)
        ? record.concrete_designs[0]?.code
        : record.concrete_designs?.code;
      const designPumpcreate = Array.isArray(record.concrete_designs)
        ? record.concrete_designs[0]?.pumpcreate
        : record.concrete_designs?.pumpcreate;

      const pumpVal = Number(record.pumpcreate ?? designPumpcreate ?? 0);
      const baseTotal = Number(record.total_amount || 0);
      const totalAmount = baseTotal + pumpVal;
      const paidAmount = allPaymentsMap.get(record.id) ?? 0;
      const isFullyPaid = record.payment_status === "paid" || (totalAmount > 0 && paidAmount >= totalAmount);
      const balanceAmount = isFullyPaid ? 0 : Math.max(0, totalAmount - paidAmount);
      const paymentStatus = isFullyPaid ? "paid" : record.payment_status;

      return {
        id: record.id,
        sale_or_number: Number(record.sale_or_number || 0),
        sale_date: record.sale_date,
        customer_name: customerName,
        concrete_design: designCode ?? "",
        total_amount: totalAmount,
        paid_amount: paidAmount,
        balance_amount: balanceAmount,
        payment_status: paymentStatus,
      };
    });

    setSales(processedSales);
    setPayments((paymentsResult.data ?? []) as unknown as PaymentRecord[]);
    setSupplierBilling(supplierBillingResult.data ?? []);
    setSupplierPayments(supplierPaymentsResult.data ?? []);
    setGrabaSummary(grabaSummaryResult.data ?? []);
    setGrabaPayments(grabaPaymentsResult.data ?? []);
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const clientCheques = useMemo<ClientChequeItem[]>(() => {
    const salesMap = new Map(sales.map((s) => [s.id, s.customer_name || "Unspecified Client"]));
    const list: ClientChequeItem[] = [];

    for (const p of payments as any[]) {
      const method = String(p.payment_method || "").toUpperCase();
      const ref = p.reference_number || "";
      if (method === "CK" || ref.toUpperCase().startsWith("CK") || (ref && method !== "CASH")) {
        list.push({
          id: p.id,
          customer_name: salesMap.get(p.sales_record_id) || "Unspecified Client",
          ck_number: ref || "CK Check",
          payment_date: p.payment_date,
          amount: Number(p.amount || 0),
        });
      }
    }
    return list.sort((a, b) => b.payment_date.localeCompare(a.payment_date));
  }, [sales, payments]);

  const supplierUnpaidList = useMemo<SupplierUnpaidItem[]>(() => {
    const map = new Map<string, SupplierUnpaidItem>();

    for (const s of supplierBilling) {
      const unpaid = Number(s.balance_amount || 0);
      if (unpaid > 0) {
        const name = s.supplier_name || "Unspecified Supplier";
        const item = map.get(name) ?? { supplier_name: name, unpaidAmount: 0, records: 0 };
        item.unpaidAmount += unpaid;
        item.records += 1;
        map.set(name, item);
      }
    }

    for (const g of grabaSummary) {
      const unpaid = Number(g.balance_amount || 0);
      if (unpaid > 0) {
        const name = g.supplier_name || "Unspecified Supplier";
        const item = map.get(name) ?? { supplier_name: name, unpaidAmount: 0, records: 0 };
        item.unpaidAmount += unpaid;
        item.records += 1;
        map.set(name, item);
      }
    }

    return Array.from(map.values()).sort((a, b) => b.unpaidAmount - a.unpaidAmount);
  }, [supplierBilling, grabaSummary]);

  const supplierCheques = useMemo<SupplierChequeItem[]>(() => {
    const suppMap = new Map(supplierBilling.map((s) => [s.id, s.supplier_name || "Unspecified Supplier"]));
    const grabaMap = new Map(grabaSummary.map((g) => [g.id, g.supplier_name || "Unspecified Supplier"]));
    const list: SupplierChequeItem[] = [];

    for (const p of supplierPayments) {
      if (p.ck_number) {
        list.push({
          id: p.id,
          supplier_name: suppMap.get(p.supplier_transaction_id) || "Unspecified Supplier",
          ck_number: p.ck_number,
          payment_date: p.payment_date,
          amount: Number(p.amount || 0),
        });
      }
    }

    for (const p of grabaPayments) {
      const method = String(p.payment_method || "").toUpperCase();
      const ref = p.reference_number || "";
      if (method === "CK" || ref.toUpperCase().startsWith("CK") || (ref && method !== "CASH")) {
        list.push({
          id: p.id,
          supplier_name: grabaMap.get(p.graba_record_id) || "Unspecified Supplier",
          ck_number: ref || "CK Check",
          payment_date: p.payment_date,
          amount: Number(p.amount || 0),
        });
      }
    }

    return list.sort((a, b) => b.payment_date.localeCompare(a.payment_date));
  }, [supplierBilling, grabaSummary, supplierPayments, grabaPayments]);

  const filteredSales = useMemo(
    () => sales.filter((row) => dateInPeriod(row.sale_date, periodMode, filters)),
    [filters, periodMode, sales],
  );

  const filteredPayments = useMemo(
    () =>
      payments.filter((row) =>
        dateInPeriod(row.payment_date, periodMode, filters),
      ),
    [filters, payments, periodMode],
  );

  const report = useMemo(() => {
    const grossSales = filteredSales.reduce(
      (sum, row) => sum + Number(row.total_amount || 0),
      0,
    );
    const paidAmount = filteredSales.reduce(
      (sum, row) => sum + Number(row.paid_amount || 0),
      0,
    );
    const unpaidAmount = filteredSales.reduce(
      (sum, row) => sum + Number(row.balance_amount || 0),
      0,
    );
    const collections = filteredPayments.reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0,
    );
    const paidSales = filteredSales.filter(
      (row) => row.payment_status === "paid",
    ).length;
    const unpaidSales = filteredSales.length - paidSales;
    const collectionRate = grossSales > 0 ? (paidAmount / grossSales) * 100 : 0;

    return {
      grossSales,
      paidAmount,
      unpaidAmount,
      collections,
      paidSales,
      unpaidSales,
      collectionRate,
      averageSale: filteredSales.length ? grossSales / filteredSales.length : 0,
      topClients: buildLeaders(filteredSales, (row) => row.customer_name ?? ""),
      topDesigns: buildLeaders(filteredSales, (row) => row.concrete_design ?? ""),
      methods: sumByMethod(filteredPayments),
      unpaidSummary: buildUnpaidSummary(filteredSales),
    };
  }, [filteredPayments, filteredSales]);

  return (
    <Stack gap='md'>
      <Paper
        withBorder
        radius='sm'
        p='md'
        className='masterPanel'
      >
        <Stack gap='md'>
          <Group justify='space-between'>
            <div>
              <Title order={2}>Dashboard</Title>
              <Text c='dimmed'>Report period: {periodLabel(periodMode, filters)}</Text>
            </div>
            <Button
              leftSection={<RefreshCw size={16} />}
              variant='light'
              onClick={loadDashboard}
              loading={loading}
            >
              Refresh
            </Button>
          </Group>

          <SegmentedControl
            value={periodMode}
            onChange={(value) => setPeriodMode(value as PeriodMode)}
            data={[
              { label: "Current Date", value: "today" },
              { label: "Range Date", value: "range" },
              { label: "Month", value: "month" },
              { label: "Yearly", value: "year" },
            ]}
          />

          <SimpleGrid
            cols={{ base: 1, sm: 2, md: 4 }}
            spacing='sm'
          >
            {periodMode === "today" && (
              <DateShortcutInput
                label='Current Date'
                value={filters.currentDate}
                onChange={(val) =>
                  setFilters((current) => ({
                    ...current,
                    currentDate: val,
                  }))
                }
              />
            )}
            {periodMode === "range" && (
              <>
                <DateShortcutInput
                  label='Start Date'
                  value={filters.startDate}
                  onChange={(val) =>
                    setFilters((current) => ({
                      ...current,
                      startDate: val,
                    }))
                  }
                />
                <DateShortcutInput
                  label='End Date'
                  value={filters.endDate}
                  onChange={(val) =>
                    setFilters((current) => ({
                      ...current,
                      endDate: val,
                    }))
                  }
                />
              </>
            )}
            {periodMode === "month" && (
              <TextInput
                label='Month'
                type='month'
                value={filters.month}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    month: event.currentTarget.value,
                  }))
                }
              />
            )}
            {periodMode === "year" && (
              <Select
                label='Year'
                data={yearOptions()}
                value={filters.year}
                onChange={(val) =>
                  setFilters((current) => ({
                    ...current,
                    year: val || thisYear(),
                  }))
                }
              />
            )}
          </SimpleGrid>
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

      <SimpleGrid
        cols={{ base: 1, sm: 2, lg: 4 }}
        spacing='md'
      >
        <MetricCard
          title='Sales'
          value={displayMoney(report.grossSales)}
          detail={`${filteredSales.length} records`}
          icon={<ReceiptText size={20} />}
        />
        <MetricCard
          title='Collections'
          value={displayMoney(report.collections)}
          detail={`${filteredPayments.length} payments received`}
          icon={<WalletCards size={20} />}
        />
        <MetricCard
          title='Unpaid Balance'
          value={displayMoney(report.unpaidAmount)}
          detail={`${report.unpaidSales} unpaid or deposit sales`}
          icon={<CreditCard size={20} />}
        />
        <MetricCard
          title='Average Sale'
          value={displayMoney(report.averageSale)}
          detail='Average per sales record'
          icon={<TrendingUp size={20} />}
        />
      </SimpleGrid>

      <SimpleGrid
        cols={{ base: 1, md: 3 }}
        spacing='md'
      >
        <Paper
          withBorder
          radius='sm'
          p='md'
          className='masterPanel'
        >
          <Stack gap='sm'>
            <Group justify='space-between'>
              <Text fw={700}>Payment Status</Text>
              <Badge variant='light'>{report.collectionRate.toFixed(1)}%</Badge>
            </Group>
            <Progress
              value={report.collectionRate}
              color='green'
              size='lg'
            />
            <SimpleGrid cols={2}>
              <div>
                <Text c='dimmed' size='sm'>Paid Sales</Text>
                <Text fw={700}>{report.paidSales}</Text>
              </div>
              <div>
                <Text c='dimmed' size='sm'>Unpaid Sales</Text>
                <Text fw={700}>{report.unpaidSales}</Text>
              </div>
            </SimpleGrid>
            <Text c='dimmed' size='sm'>
              Paid amount: {displayMoney(report.paidAmount)}
            </Text>
          </Stack>
        </Paper>

        <LeaderCard
          title='Top Clients'
          rows={report.topClients.slice(0, 5)}
        />
        <LeaderCard
          title='Top Designs'
          rows={report.topDesigns.slice(0, 5)}
        />
      </SimpleGrid>

      <SimpleGrid
        cols={{ base: 1, md: 2 }}
        spacing='md'
      >
        <Paper
          withBorder
          radius='sm'
          p='md'
          className='masterPanel'
        >
          <Stack gap='sm'>
            <Group justify='space-between'>
              <Text fw={700}>Payment Methods</Text>
              <Badge variant='light'>{report.methods.length} methods</Badge>
            </Group>
            <ScrollArea type='auto'>
              <Table withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Method</Table.Th>
                    <Table.Th>Amount</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {report.methods.map((method) => (
                    <Table.Tr key={method.method}>
                      <Table.Td>{method.method}</Table.Td>
                      <Table.Td>{displayMoney(method.amount)}</Table.Td>
                    </Table.Tr>
                  ))}
                  {!report.methods.length && (
                    <Table.Tr>
                      <Table.Td colSpan={2}>No payments to display</Table.Td>
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
              <Text fw={700}>Recent Sales</Text>
              <CalendarDays size={18} />
            </Group>
            <ScrollArea type='auto'>
              <Table withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>OR</Table.Th>
                    <Table.Th>Client</Table.Th>
                    <Table.Th>Amount</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredSales.slice(0, 8).map((sale) => (
                    <Table.Tr key={sale.id}>
                      <Table.Td>{sale.sale_date}</Table.Td>
                      <Table.Td>{sale.sale_or_number}</Table.Td>
                      <Table.Td>{sale.customer_name || "No client"}</Table.Td>
                      <Table.Td>{displayMoney(sale.total_amount)}</Table.Td>
                    </Table.Tr>
                  ))}
                  {!filteredSales.length && (
                    <Table.Tr>
                      <Table.Td colSpan={4}>No sales to display</Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Stack>
        </Paper>
      </SimpleGrid>

      {/* 3 Cards: Client Cheques, Supplier Unpaid, Supplier Cheques */}
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        <ClientChequesCard items={clientCheques} />
        <SupplierUnpaidCard items={supplierUnpaidList} />
        <SupplierChequesCard items={supplierCheques} />
      </SimpleGrid>

      <Paper
        withBorder
        radius='sm'
        p='md'
        className='masterPanel'
      >
        <Stack gap='sm'>
          <Group justify='space-between'>
            <div>
              <Text fw={700}>Unpaid Summary</Text>
              <Text c='dimmed' size='sm'>
                Customer balances for {periodLabel(periodMode, filters)}
              </Text>
            </div>
            <Badge variant='light'>{displayMoney(report.unpaidAmount)}</Badge>
          </Group>
          <ScrollArea type='auto'>
            <Table withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Customer Name</Table.Th>
                  <Table.Th>Unpaid Amount</Table.Th>
                  <Table.Th>Records</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {report.unpaidSummary.map((customer) => (
                  <Table.Tr key={customer.customer}>
                    <Table.Td>{customer.customer}</Table.Td>
                    <Table.Td>{displayMoney(customer.unpaidAmount)}</Table.Td>
                    <Table.Td>{customer.records}</Table.Td>
                  </Table.Tr>
                ))}
                {!report.unpaidSummary.length && (
                  <Table.Tr>
                    <Table.Td colSpan={3}>No unpaid balances to display</Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Stack>
      </Paper>
    </Stack>
  );
}

function ClientChequesCard({ items }: { items: ClientChequeItem[] }) {
  const totalAmount = useMemo(() => items.reduce((sum, item) => sum + item.amount, 0), [items]);

  return (
    <Paper withBorder radius="sm" p="md" className="masterPanel">
      <Stack gap="xs">
        <Group justify="space-between">
          <Group gap="xs">
            <ThemeIcon size={28} radius="md" color="blue" variant="light">
              <CreditCard size={16} />
            </ThemeIcon>
            <div>
              <Text fw={700} size="sm">Client Cheques</Text>
              <Text size="xs" c="dimmed">Pending Deposit ({items.length})</Text>
            </div>
          </Group>
          <Badge color="blue" variant="light">
            {displayMoney(totalAmount)}
          </Badge>
        </Group>

        <ScrollArea h={220} type="auto">
          <Stack gap="xs">
            {items.map((item, index) => (
              <Paper
                key={`${item.id}-${index}`}
                p="xs"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: "6px",
                }}
              >
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <div>
                    <Text size="xs" fw={700} c="white">
                      {item.customer_name}
                    </Text>
                    <Group gap={6} mt={2}>
                      <Badge size="xs" color="gray" variant="outline">
                        CK: {item.ck_number || "N/A"}
                      </Badge>
                      <Text size="xs" c="dimmed">
                        {displayDate(item.payment_date)}
                      </Text>
                    </Group>
                  </div>
                  <Stack gap={2} align="flex-end">
                    <Text size="xs" fw={700} c="blue.4">
                      {displayMoney(item.amount)}
                    </Text>
                    <Badge size="xs" color="yellow" variant="light">
                      Pending Deposit
                    </Badge>
                  </Stack>
                </Group>
              </Paper>
            ))}
            {!items.length && (
              <Text size="xs" c="dimmed" style={{ textAlign: "center", paddingTop: "50px" }}>
                No pending client cheques
              </Text>
            )}
          </Stack>
        </ScrollArea>
      </Stack>
    </Paper>
  );
}

function SupplierUnpaidCard({ items }: { items: SupplierUnpaidItem[] }) {
  const totalAmount = useMemo(() => items.reduce((sum, item) => sum + item.unpaidAmount, 0), [items]);

  return (
    <Paper withBorder radius="sm" p="md" className="masterPanel">
      <Stack gap="xs">
        <Group justify="space-between">
          <Group gap="xs">
            <ThemeIcon size={28} radius="md" color="red" variant="light">
              <ReceiptText size={16} />
            </ThemeIcon>
            <div>
              <Text fw={700} size="sm">Supplier Unpaid</Text>
              <Text size="xs" c="dimmed">Unpaid Accounts ({items.length})</Text>
            </div>
          </Group>
          <Badge color="red" variant="light">
            {displayMoney(totalAmount)}
          </Badge>
        </Group>

        <ScrollArea h={220} type="auto">
          <Stack gap="xs">
            {items.map((item) => (
              <Paper
                key={item.supplier_name}
                p="xs"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: "6px",
                }}
              >
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <div>
                    <Text size="xs" fw={700} c="white">
                      {item.supplier_name}
                    </Text>
                    <Text size="xs" c="dimmed" mt={2}>
                      {item.records} unpaid record{item.records > 1 ? "s" : ""}
                    </Text>
                  </div>
                  <Stack gap={2} align="flex-end">
                    <Text size="xs" fw={700} c="red.4">
                      {displayMoney(item.unpaidAmount)}
                    </Text>
                    <Badge size="xs" color="red" variant="light">
                      Unpaid
                    </Badge>
                  </Stack>
                </Group>
              </Paper>
            ))}
            {!items.length && (
              <Text size="xs" c="dimmed" style={{ textAlign: "center", paddingTop: "50px" }}>
                No unpaid supplier balances
              </Text>
            )}
          </Stack>
        </ScrollArea>
      </Stack>
    </Paper>
  );
}

function SupplierChequesCard({ items }: { items: SupplierChequeItem[] }) {
  const totalAmount = useMemo(() => items.reduce((sum, item) => sum + item.amount, 0), [items]);

  return (
    <Paper withBorder radius="sm" p="md" className="masterPanel">
      <Stack gap="xs">
        <Group justify="space-between">
          <Group gap="xs">
            <ThemeIcon size={28} radius="md" color="orange" variant="light">
              <WalletCards size={16} />
            </ThemeIcon>
            <div>
              <Text fw={700} size="sm">Supplier Cheques</Text>
              <Text size="xs" c="dimmed">Pending Clearance/Deposit ({items.length})</Text>
            </div>
          </Group>
          <Badge color="orange" variant="light">
            {displayMoney(totalAmount)}
          </Badge>
        </Group>

        <ScrollArea h={220} type="auto">
          <Stack gap="xs">
            {items.map((item, index) => (
              <Paper
                key={`${item.id}-${index}`}
                p="xs"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: "6px",
                }}
              >
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <div>
                    <Text size="xs" fw={700} c="white">
                      {item.supplier_name}
                    </Text>
                    <Group gap={6} mt={2}>
                      <Badge size="xs" color="gray" variant="outline">
                        CK: {item.ck_number || "N/A"}
                      </Badge>
                      <Text size="xs" c="dimmed">
                        {displayDate(item.payment_date)}
                      </Text>
                    </Group>
                  </div>
                  <Stack gap={2} align="flex-end">
                    <Text size="xs" fw={700} c="orange.4">
                      {displayMoney(item.amount)}
                    </Text>
                    <Badge size="xs" color="orange" variant="light">
                      Pending Deposit
                    </Badge>
                  </Stack>
                </Group>
              </Paper>
            ))}
            {!items.length && (
              <Text size="xs" c="dimmed" style={{ textAlign: "center", paddingTop: "50px" }}>
                No pending supplier cheques
              </Text>
            )}
          </Stack>
        </ScrollArea>
      </Stack>
    </Paper>
  );
}


type MetricCardProps = {
  title: string;
  value: string;
  detail: string;
  icon: ReactNode;
};

function MetricCard({ title, value, detail, icon }: MetricCardProps) {
  return (
    <Paper
      withBorder
      p="lg"
      className="masterPanel"
      style={{
        position: "relative",
        overflow: "hidden",
        cursor: "default",
        border: "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "90px",
          height: "90px",
          background: "radial-gradient(circle, rgba(37, 99, 235, 0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <Group justify="space-between" align="flex-start">
        <Stack gap="xs">
          <Text c="dimmed" size="xs" fw={700} style={{ textTransform: "uppercase", letterSpacing: "1px" }}>
            {title}
          </Text>
          <Text fw={800} size="xl" style={{ fontSize: "22px", color: "#ffffff", letterSpacing: "-0.5px" }}>
            {value}
          </Text>
          <Text c="dimmed" size="xs">
            {detail}
          </Text>
        </Stack>
        <ThemeIcon size={42} radius="md" variant="light" color="blue" style={{ border: "1px solid rgba(37, 99, 235, 0.2)" }}>
          {icon}
        </ThemeIcon>
      </Group>
    </Paper>
  );
}

function LeaderCard({ title, rows }: { title: string; rows: LeaderItem[] }) {
  return (
    <Paper
      withBorder
      p="md"
      className="masterPanel"
    >
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={700} size="md">{title}</Text>
          <Badge variant="light" color="blue">{rows.length}</Badge>
        </Group>
        <ScrollArea type="auto">
          <Table verticalSpacing="xs" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ borderBottom: "1.5px solid rgba(255, 255, 255, 0.08)" }}>Name</Table.Th>
                <Table.Th style={{ borderBottom: "1.5px solid rgba(255, 255, 255, 0.08)" }}>Count</Table.Th>
                <Table.Th style={{ borderBottom: "1.5px solid rgba(255, 255, 255, 0.08)" }}>Sales</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row) => (
                <Table.Tr key={row.label}>
                  <Table.Td style={{ fontWeight: 500 }}>{row.label}</Table.Td>
                  <Table.Td>{row.count}</Table.Td>
                  <Table.Td style={{ fontWeight: 600, color: "#60a5fa" }}>{displayMoney(row.amount)}</Table.Td>
                </Table.Tr>
              ))}
              {!rows.length && (
                <Table.Tr>
                  <Table.Td colSpan={3} style={{ textAlign: "center", color: "rgba(255,255,255,0.3)" }}>
                    No data to display
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Stack>
    </Paper>
  );
}

