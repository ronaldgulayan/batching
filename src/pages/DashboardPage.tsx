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
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
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

export function DashboardPage() {
  const [sales, setSales] = useState<SalesSummaryRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
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

    const [salesResult, paymentsResult] = await Promise.all([
      supabase
        .from("sales_billing_summary")
        .select(
          "id,sale_or_number,sale_date,customer_name,concrete_design,total_amount,paid_amount,balance_amount,payment_status",
        )
        .order("sale_date", { ascending: false }),
      supabase
        .from("sales_payments")
        .select("id,sales_record_id,payment_date,amount,payment_method")
        .order("payment_date", { ascending: false }),
    ]);

    setLoading(false);

    if (salesResult.error || paymentsResult.error) {
      setError(salesResult.error?.message || paymentsResult.error?.message || "");
      return;
    }

    setSales((salesResult.data ?? []) as unknown as SalesSummaryRecord[]);
    setPayments((paymentsResult.data ?? []) as unknown as PaymentRecord[]);
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

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
              <TextInput
                label='Current Date'
                type='date'
                value={filters.currentDate}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    currentDate: event.currentTarget.value,
                  }))
                }
              />
            )}
            {periodMode === "range" && (
              <>
                <TextInput
                  label='Start Date'
                  type='date'
                  value={filters.startDate}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      startDate: event.currentTarget.value,
                    }))
                  }
                />
                <TextInput
                  label='End Date'
                  type='date'
                  value={filters.endDate}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      endDate: event.currentTarget.value,
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
              <TextInput
                label='Year'
                type='number'
                min={2000}
                value={filters.year}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    year: event.currentTarget.value,
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
      radius='sm'
      p='md'
      className='masterPanel'
    >
      <Group justify='space-between' align='flex-start'>
        <div>
          <Text c='dimmed' size='sm'>{title}</Text>
          <Text fw={800} size='xl'>{value}</Text>
          <Text c='dimmed' size='sm'>{detail}</Text>
        </div>
        {icon}
      </Group>
    </Paper>
  );
}

function LeaderCard({ title, rows }: { title: string; rows: LeaderItem[] }) {
  return (
    <Paper
      withBorder
      radius='sm'
      p='md'
      className='masterPanel'
    >
      <Stack gap='sm'>
        <Group justify='space-between'>
          <Text fw={700}>{title}</Text>
          <Badge variant='light'>{rows.length}</Badge>
        </Group>
        <Table withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Count</Table.Th>
              <Table.Th>Sales</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={row.label}>
                <Table.Td>{row.label}</Table.Td>
                <Table.Td>{row.count}</Table.Td>
                <Table.Td>{displayMoney(row.amount)}</Table.Td>
              </Table.Tr>
            ))}
            {!rows.length && (
              <Table.Tr>
                <Table.Td colSpan={3}>No data to display</Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Stack>
    </Paper>
  );
}
