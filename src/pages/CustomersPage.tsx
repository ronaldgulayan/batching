import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Group,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  TextInput,
} from "@mantine/core";
import { AlertCircle, RefreshCw } from "lucide-react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

type ClientRow = {
  id: string;
  client_name: string;
  sale_or_number: number;
  sale_date: string;
  design: string;
  cubic_volume: number;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  payment_status: string;
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

type ClientGroup = {
  key: string;
  clientName: string;
  rows: ClientRow[];
  totalAmount: number;
  latestDate: string;
};

function clientKey(name: string) {
  return name.trim().toLowerCase() || "no-client";
}

function clientDateKey(row: ClientRow) {
  return `${clientKey(row.client_name)}|${row.sale_date}`;
}

function displayMoney(value: number) {
  return `PHP ${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function CustomersPage() {
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [designFilter, setDesignFilter] = useState<string | null>(null);

  const designOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.design).filter(Boolean)))
        .sort((first, second) => first.localeCompare(second))
        .map((design) => ({ value: design, label: design })),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (dateFilter && row.sale_date !== dateFilter) return false;
      if (designFilter && row.design !== designFilter) return false;
      if (!query) return true;

      return [
        row.client_name,
        row.sale_or_number,
        row.sale_date,
        row.design,
        row.cubic_volume,
        row.total_amount,
        row.paid_amount,
        row.balance_amount,
        row.payment_status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [dateFilter, designFilter, rows, search]);

  const groupedRows = useMemo<ClientGroup[]>(() => {
    const groups = new Map<string, ClientGroup>();

    for (const row of filteredRows) {
      const key = clientDateKey(row);
      const group = groups.get(key);

      if (group) {
        group.rows.push(row);
        group.totalAmount += row.total_amount;
        if (row.sale_date > group.latestDate) group.latestDate = row.sale_date;
      } else {
        groups.set(key, {
          key,
          clientName: row.client_name || "No client",
          rows: [row],
          totalAmount: row.total_amount,
          latestDate: row.sale_date,
        });
      }
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        rows: [...group.rows].sort((first, second) =>
          Number(first.sale_or_number) - Number(second.sale_or_number),
        ),
      }))
      .sort((first, second) => {
        const clientSort = first.clientName.localeCompare(second.clientName);
        if (clientSort !== 0) return clientSort;
        return second.latestDate.localeCompare(first.latestDate);
      });
  }, [filteredRows]);

  async function loadClients() {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError("");

    const { data, error: loadError } = await supabase
      .from("sales_billing_summary")
      .select(
        "id,sale_or_number,sale_date,customer_name,concrete_design,cubic_volume,total_amount,paid_amount,balance_amount,payment_status",
      )
      .order("sale_date", { ascending: false });

    setLoading(false);

    if (loadError) {
      setError(loadError.message);
      return;
    }

    setRows(
      ((data ?? []) as unknown as SummaryRecord[]).map((record) => ({
        id: record.id,
        client_name: record.customer_name ?? "",
        sale_or_number: Number(record.sale_or_number || 0),
        sale_date: record.sale_date,
        design: record.concrete_design ?? "",
        cubic_volume: Number(record.cubic_volume || 0),
        total_amount: Number(record.total_amount || 0),
        paid_amount: Number(record.paid_amount || 0),
        balance_amount: Number(record.balance_amount || 0),
        payment_status: record.payment_status,
      })),
    );
  }

  useEffect(() => {
    void loadClients();
  }, []);

  return (
    <Stack gap='md'>
      <div className='formActions'>
        <Button
          leftSection={<RefreshCw size={16} />}
          variant='light'
          onClick={loadClients}
          loading={loading}
        >
          Refresh
        </Button>
      </div>

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

      <Paper
        withBorder
        radius='sm'
        p='md'
        className='masterPanel'
      >
        <Stack gap='md'>
          <Group justify='space-between'>
            <Badge variant='outline'>Clients List</Badge>
            <Badge variant='light'>
              {filteredRows.length} of {rows.length} records
            </Badge>
          </Group>
          <SimpleGrid
            cols={{ base: 1, sm: 3 }}
            spacing='sm'
          >
            <TextInput
              placeholder='Search any'
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
            <TextInput
              type='date'
              value={dateFilter}
              onChange={(event) => setDateFilter(event.currentTarget.value)}
            />
            <Select
              placeholder='Filter by design'
              data={designOptions}
              value={designFilter}
              onChange={setDesignFilter}
              clearable
              searchable
            />
          </SimpleGrid>
        </Stack>
      </Paper>

      <Paper
        withBorder
        radius='sm'
        p='md'
        className='masterPanel'
      >
        <ScrollArea type='auto'>
          <Table
            withTableBorder
            withColumnBorders
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Client</Table.Th>
                <Table.Th>OR</Table.Th>
                <Table.Th>Date</Table.Th>
                <Table.Th>Design</Table.Th>
                <Table.Th>Cubic</Table.Th>
                <Table.Th>Amount</Table.Th>
                <Table.Th>Paid</Table.Th>
                <Table.Th>Unpaid</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Total</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {groupedRows.map((group) =>
                group.rows.map((row, index) => {
                  const isPaid = row.payment_status === "paid";

                  return (
                    <Table.Tr key={row.id}>
                      {index === 0 && (
                        <Table.Td rowSpan={group.rows.length}>
                          {group.clientName}
                        </Table.Td>
                      )}
                      <Table.Td>{row.sale_or_number}</Table.Td>
                      <Table.Td>{row.sale_date}</Table.Td>
                      <Table.Td>{row.design}</Table.Td>
                      <Table.Td>{row.cubic_volume}</Table.Td>
                      <Table.Td>{displayMoney(row.total_amount)}</Table.Td>
                      <Table.Td>{displayMoney(row.paid_amount)}</Table.Td>
                      <Table.Td>{displayMoney(row.balance_amount)}</Table.Td>
                      <Table.Td>
                        <Badge
                          color={isPaid ? "green" : "red"}
                          variant='light'
                        >
                          {isPaid ? "paid" : "unpaid"}
                        </Badge>
                      </Table.Td>
                      {index === 0 && (
                        <Table.Td rowSpan={group.rows.length}>
                          {displayMoney(group.totalAmount)}
                        </Table.Td>
                      )}
                    </Table.Tr>
                  );
                }),
              )}
              {!groupedRows.length && (
                <Table.Tr>
                  <Table.Td colSpan={10}>No clients to display</Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>
    </Stack>
  );
}
