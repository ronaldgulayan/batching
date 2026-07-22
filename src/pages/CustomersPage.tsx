import { useEffect, useMemo, useState } from "react";
import {
  Accordion,
  Alert,
  Badge,
  Button,
  Group,
  Pagination,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { AlertCircle, RefreshCw, Search, UserCheck } from "lucide-react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { DateShortcutInput } from "../components/DateShortcutInput";

type DateMode = "day" | "month" | "year" | "all";
type StatusFilter = "all" | "unpaid" | "paid";

type SalesPaymentRecord = {
  id: string;
  sales_record_id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  remarks: string | null;
};

type SummaryRecord = {
  id: string;
  sale_or_number: number | null;
  sale_date: string;
  customer_name: string | null;
  concrete_design: string | null;
  cubic_volume: number;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  payment_status: string;
};

type SaleWithPayments = {
  id: string;
  sale_or_number: number;
  sale_date: string;
  design: string;
  cubic_volume: number;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  payment_status: string;
  payments: SalesPaymentRecord[];
};

type ClientGroup = {
  clientName: string;
  sales: SaleWithPayments[];
  totalSalesAmount: number;
  totalPaidAmount: number;
  totalBalanceAmount: number;
  latestDate: string;
  hasUnpaid: boolean;
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

function displayMoney(value: number) {
  return `PHP ${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function CustomersPage() {
  const [salesRecords, setSalesRecords] = useState<SummaryRecord[]>([]);
  const [salesPayments, setSalesPayments] = useState<SalesPaymentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Filters state
  const [search, setSearch] = useState("");
  const [dateMode, setDateMode] = useState<DateMode>("month");
  const [selectedDay, setSelectedDay] = useState(today());
  const [selectedMonth, setSelectedMonth] = useState(thisMonth());
  const [selectedYear, setSelectedYear] = useState(thisYear());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Pagination state
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Reset page to 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [search, dateMode, selectedDay, selectedMonth, selectedYear, statusFilter]);

  async function loadClients() {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError("");

    const [billingRes, paymentsRes] = await Promise.all([
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
    ]);

    setLoading(false);

    if (billingRes.error || paymentsRes.error) {
      setError(billingRes.error?.message || paymentsRes.error?.message || "");
      return;
    }

    const rawSales = (billingRes.data ?? []) as any[];
    const processedSummary: SummaryRecord[] = rawSales.map((record) => {
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

      return {
        id: record.id,
        sale_or_number: Number(record.sale_or_number || 0),
        sale_date: record.sale_date,
        customer_name: customerName,
        concrete_design: designCode ?? "",
        cubic_volume: Number(record.cubic_volume || 0),
        total_amount: totalAmount,
        paid_amount: 0,
        balance_amount: 0,
        payment_status: record.payment_status,
      };
    });

    setSalesRecords(processedSummary);
    setSalesPayments((paymentsRes.data ?? []) as unknown as SalesPaymentRecord[]);
  }

  useEffect(() => {
    void loadClients();
  }, []);

  const filteredClientGroups = useMemo<ClientGroup[]>(() => {
    const searchLower = search.trim().toLowerCase();

    // Group payments by sales_record_id
    const paymentsMap = new Map<string, SalesPaymentRecord[]>();
    for (const p of salesPayments) {
      const list = paymentsMap.get(p.sales_record_id) ?? [];
      list.push(p);
      paymentsMap.set(p.sales_record_id, list);
    }

    // Filter sales records
    const filteredSales = salesRecords.filter((sale) => {
      // 1. Client search
      if (searchLower) {
        const name = (sale.customer_name || "").toLowerCase();
        if (!name.includes(searchLower)) return false;
      }

      // 2. Date filter
      if (dateMode === "day" && selectedDay) {
        if (sale.sale_date !== selectedDay) return false;
      } else if (dateMode === "month" && selectedMonth) {
        if (!sale.sale_date.startsWith(selectedMonth)) return false;
      } else if (dateMode === "year" && selectedYear) {
        if (!sale.sale_date.startsWith(selectedYear)) return false;
      }

      // 3. Status filter
      if (statusFilter === "unpaid") {
        if (sale.payment_status === "paid") return false;
      } else if (statusFilter === "paid") {
        if (sale.payment_status !== "paid") return false;
      }

      return true;
    });

    // Group filtered sales by Client Name
    const clientMap = new Map<string, ClientGroup>();

    for (const sale of filteredSales) {
      const clientName = sale.customer_name?.trim() || "Unspecified Client";
      const paymentsForSale = paymentsMap.get(sale.id) || [];
      const paidAmount = paymentsForSale.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const isFullyPaid = sale.payment_status === "paid" || (sale.total_amount > 0 && paidAmount >= sale.total_amount);
      const balanceAmount = isFullyPaid ? 0 : Math.max(0, sale.total_amount - paidAmount);
      const paymentStatus = isFullyPaid ? "paid" : sale.payment_status;

      const saleWithPayments: SaleWithPayments = {
        id: sale.id,
        sale_or_number: Number(sale.sale_or_number || 0),
        sale_date: sale.sale_date,
        design: sale.concrete_design || "",
        cubic_volume: Number(sale.cubic_volume || 0),
        total_amount: sale.total_amount,
        paid_amount: paidAmount,
        balance_amount: balanceAmount,
        payment_status: paymentStatus,
        payments: paymentsForSale,
      };

      const group = clientMap.get(clientName);
      if (group) {
        group.sales.push(saleWithPayments);
        group.totalSalesAmount += saleWithPayments.total_amount;
        group.totalPaidAmount += saleWithPayments.paid_amount;
        group.totalBalanceAmount += saleWithPayments.balance_amount;
        if (saleWithPayments.balance_amount > 0 && saleWithPayments.payment_status !== "paid") group.hasUnpaid = true;
        if (saleWithPayments.sale_date > group.latestDate) group.latestDate = saleWithPayments.sale_date;
      } else {
        clientMap.set(clientName, {
          clientName,
          sales: [saleWithPayments],
          totalSalesAmount: saleWithPayments.total_amount,
          totalPaidAmount: saleWithPayments.paid_amount,
          totalBalanceAmount: saleWithPayments.balance_amount,
          latestDate: saleWithPayments.sale_date,
          hasUnpaid: saleWithPayments.balance_amount > 0 && saleWithPayments.payment_status !== "paid",
        });
      }
    }

    return Array.from(clientMap.values()).sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [salesRecords, salesPayments, search, dateMode, selectedDay, selectedMonth, selectedYear, statusFilter]);

  const totalPages = Math.ceil(filteredClientGroups.length / pageSize) || 1;
  const paginatedGroups = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredClientGroups.slice(start, start + pageSize);
  }, [filteredClientGroups, page, pageSize]);

  return (
    <Stack gap="md">
      <div className="formActions">
        <Button
          leftSection={<RefreshCw size={16} />}
          variant="light"
          onClick={loadClients}
          loading={loading}
        >
          Refresh
        </Button>
      </div>

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

      {/* Filter Panel */}
      <Paper withBorder radius="sm" p="md" className="masterPanel">
        <Stack gap="md">
          <Group justify="space-between">
            <Group gap="xs">
              <UserCheck size={18} />
              <Text fw={700}>Client Directory</Text>
            </Group>
            <Badge variant="light">
              Showing {filteredClientGroups.length} clients
            </Badge>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
            <TextInput
              label="Client Name"
              placeholder="Search client name..."
              leftSection={<Search size={16} />}
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
            />

            <Stack gap={2}>
              <Text size="sm" fw={500}>
                Date Filter Mode
              </Text>
              <SegmentedControl
                size="xs"
                value={dateMode}
                onChange={(val) => setDateMode(val as DateMode)}
                data={[
                  { label: "Day", value: "day" },
                  { label: "Month", value: "month" },
                  { label: "Year", value: "year" },
                  { label: "All", value: "all" },
                ]}
              />
            </Stack>

            {dateMode === "day" && (
              <DateShortcutInput
                label="Date"
                value={selectedDay}
                onChange={(val) => setSelectedDay(val)}
              />
            )}

            {dateMode === "month" && (
              <TextInput
                label="Month"
                type="month"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.currentTarget.value)}
              />
            )}

            {dateMode === "year" && (
              <Select
                label="Year"
                data={yearOptions()}
                value={selectedYear}
                onChange={(val) => setSelectedYear(val || thisYear())}
              />
            )}

            <Stack gap={2}>
              <Text size="sm" fw={500}>
                Payment Status
              </Text>
              <SegmentedControl
                size="xs"
                value={statusFilter}
                onChange={(val) => setStatusFilter(val as StatusFilter)}
                data={[
                  { label: "All", value: "all" },
                  { label: "Unpaid", value: "unpaid" },
                  { label: "Paid", value: "paid" },
                ]}
              />
            </Stack>
          </SimpleGrid>
        </Stack>
      </Paper>

      {/* Accordion Client List */}
      <Paper withBorder radius="sm" p="md" className="masterPanel">
        <Stack gap="md">
          <Accordion variant="separated" radius="md">
            {paginatedGroups.map((client) => (
              <Accordion.Item
                key={client.clientName}
                value={client.clientName}
                style={{
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  background: "#111622",
                  marginBottom: "8px",
                }}
              >
                <Accordion.Control>
                  <Group justify="space-between" wrap="nowrap" pr="md">
                    <Group gap="sm">
                      <Text fw={700} size="md" c="white">
                        {client.clientName}
                      </Text>
                      <Badge size="xs" variant="light" color="blue">
                        {client.sales.length} order{client.sales.length > 1 ? "s" : ""}
                      </Badge>
                    </Group>
                    <Group gap="xs">
                      {client.hasUnpaid ? (
                        <Badge color="red" variant="light" size="sm">
                          Unpaid: {displayMoney(client.totalBalanceAmount)}
                        </Badge>
                      ) : (
                        <Badge color="green" variant="light" size="sm">
                          Fully Paid
                        </Badge>
                      )}
                      <Text size="sm" fw={600} c="gray.3">
                        Total: {displayMoney(client.totalSalesAmount)}
                      </Text>
                    </Group>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <ScrollArea type="auto">
                    <Table withTableBorder withColumnBorders highlightOnHover verticalSpacing="xs">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>OR #</Table.Th>
                          <Table.Th>Date</Table.Th>
                          <Table.Th>Design</Table.Th>
                          <Table.Th>Cubic (m³)</Table.Th>
                          <Table.Th>Total Amount</Table.Th>
                          <Table.Th>Paid Amount</Table.Th>
                          <Table.Th>Balance</Table.Th>
                          <Table.Th>Status</Table.Th>
                          <Table.Th>Payments Received</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {client.sales.map((sale) => {
                          const isPaid = sale.payment_status === "paid";
                          return (
                            <Table.Tr key={sale.id}>
                              <Table.Td fw={700}>{sale.sale_or_number}</Table.Td>
                              <Table.Td>{sale.sale_date}</Table.Td>
                              <Table.Td>{sale.design}</Table.Td>
                              <Table.Td>{sale.cubic_volume}</Table.Td>
                              <Table.Td fw={700}>{displayMoney(sale.total_amount)}</Table.Td>
                              <Table.Td c="green.4">{displayMoney(sale.paid_amount)}</Table.Td>
                              <Table.Td c={sale.balance_amount > 0 ? "red.4" : "dimmed"}>
                                {displayMoney(sale.balance_amount)}
                              </Table.Td>
                              <Table.Td>
                                <Badge color={isPaid ? "green" : "red"} variant="light" size="xs">
                                  {isPaid ? "Paid" : "Unpaid"}
                                </Badge>
                              </Table.Td>
                              <Table.Td>
                                {sale.payments.length > 0 ? (
                                  <Stack gap={4}>
                                    {sale.payments.map((pm) => (
                                      <Group key={pm.id} gap={6}>
                                        <Badge size="xs" color={pm.payment_method === "CK" ? "orange" : "blue"} variant="outline">
                                          {pm.payment_method}
                                        </Badge>
                                        {pm.reference_number && (
                                          <Text size="xs" c="dimmed">
                                            Ref: {pm.reference_number}
                                          </Text>
                                        )}
                                        <Text size="xs" fw={600}>
                                          {displayMoney(pm.amount)}
                                        </Text>
                                        <Text size="xs" c="dimmed">
                                          ({pm.payment_date})
                                        </Text>
                                      </Group>
                                    ))}
                                  </Stack>
                                ) : (
                                  <Text size="xs" c="dimmed">
                                    No payments recorded
                                  </Text>
                                )}
                              </Table.Td>
                            </Table.Tr>
                          );
                        })}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>

          {!filteredClientGroups.length && (
            <Text c="dimmed" style={{ textAlign: "center", padding: "40px" }}>
              No clients found matching the selected filters.
            </Text>
          )}

          {/* Pagination */}
          {filteredClientGroups.length > 0 && (
            <Group justify="space-between" align="center" mt="md">
              <Text size="xs" c="dimmed">
                Page {page} of {totalPages} ({filteredClientGroups.length} total clients)
              </Text>
              <Pagination
                value={page}
                onChange={setPage}
                total={totalPages}
                color="blue"
                size="sm"
                radius="md"
              />
            </Group>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
