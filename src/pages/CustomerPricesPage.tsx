import { useEffect, useMemo, useRef, useState } from 'react';
import jspreadsheet from 'jspreadsheet-ce';
import { Alert, Badge, Button, Group, Paper, ScrollArea, Stack, Text, Title } from '@mantine/core';
import { AlertCircle, HandCoins, RefreshCw, Save } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

type Lookup = {
  id: string;
  label: string;
};

type PriceRecord = {
  id: string;
  customer_id: string;
  concrete_design_id: string;
  unit_price: number;
  remarks: string | null;
  customers?: { name: string } | { name: string }[] | null;
  concrete_designs?: { code: string } | { code: string }[] | null;
};

const labelToId = (items: Lookup[], label: unknown) =>
  items.find((item) => item.label === String(label ?? '').trim())?.id;

const relatedName = (value: PriceRecord['customers']) =>
  Array.isArray(value) ? value[0]?.name : value?.name;

const relatedCode = (value: PriceRecord['concrete_designs']) =>
  Array.isArray(value) ? value[0]?.code : value?.code;

export function CustomerPricesPage() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<any>(null);
  const [customers, setCustomers] = useState<Lookup[]>([]);
  const [designs, setDesigns] = useState<Lookup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const emptyRows = useMemo(() => Array.from({ length: 12 }, () => ['', '', '', '', '']), []);
  const worksheet = () => (Array.isArray(sheetRef.current) ? sheetRef.current[0] : sheetRef.current);

  async function loadLookups() {
    const [{ data: customerData, error: customerError }, { data: designData, error: designError }] =
      await Promise.all([
        supabase.from('customers').select('id,name').order('name'),
        supabase.from('concrete_designs').select('id,code').order('code'),
      ]);

    if (customerError || designError) {
      throw new Error(customerError?.message || designError?.message);
    }

    const nextCustomers = (customerData ?? []).map((customer) => ({
      id: customer.id,
      label: customer.name,
    }));
    const nextDesigns = (designData ?? []).map((design) => ({
      id: design.id,
      label: design.code,
    }));

    setCustomers(nextCustomers);
    setDesigns(nextDesigns);
    return { customers: nextCustomers, designs: nextDesigns };
  }

  async function loadRows() {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const lookups = await loadLookups();
      const { data, error: loadError } = await supabase
        .from('customer_concrete_prices')
        .select('id,customer_id,concrete_design_id,unit_price,remarks,customers(name),concrete_designs(code)')
        .order('created_at', { ascending: false })
        .limit(300);

      if (loadError) throw new Error(loadError.message);

      const records = (data ?? []) as unknown as PriceRecord[];
      const rows = records.length
        ? records.map((record) => [
            record.id,
            relatedName(record.customers) ??
              lookups.customers.find((item) => item.id === record.customer_id)?.label ??
              '',
            relatedCode(record.concrete_designs) ??
              lookups.designs.find((item) => item.id === record.concrete_design_id)?.label ??
              '',
            record.unit_price,
            record.remarks ?? '',
          ])
        : emptyRows;

      worksheet()?.setData(rows);
      setMessage(`Loaded ${data?.length ?? 0} prices.`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load prices.');
    } finally {
      setLoading(false);
    }
  }

  async function saveRows() {
    if (!sheetRef.current) return;
    setLoading(true);
    setError('');
    setMessage('');

    const rows = worksheet().getData();
    const records = rows
      .map((row: unknown[]) => {
        const customerId = labelToId(customers, row[1]);
        const designId = labelToId(designs, row[2]);
        if (!customerId || !designId || row[3] === '') return null;

        return {
          id: String(row[0] || '') || undefined,
          customer_id: customerId,
          concrete_design_id: designId,
          unit_price: Number(row[3] || 0),
          remarks: String(row[4] || '').trim() || null,
        };
      })
      .filter(Boolean);

    if (!records.length) {
      setLoading(false);
      setMessage('No complete price rows to save yet.');
      return;
    }

    const { error: saveError } = await supabase.from('customer_concrete_prices').upsert(records, {
      onConflict: 'id',
    });

    setLoading(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setMessage(`Saved ${records.length} price rows.`);
    await loadRows();
  }

  useEffect(() => {
    if (!hostRef.current) return;

    hostRef.current.innerHTML = '';
    sheetRef.current = jspreadsheet(hostRef.current, {
      worksheets: [
        {
          data: emptyRows,
          minDimensions: [5, 12],
          columns: [
            { title: 'ID', type: 'text', width: 230, readOnly: true },
            { title: 'Customer', type: 'dropdown', width: 240, source: customers.map((customer) => customer.label) },
            { title: 'Concrete Design', type: 'dropdown', width: 180, source: designs.map((design) => design.label) },
            { title: 'Unit Price', type: 'numeric', width: 140 },
            { title: 'Remarks', type: 'text', width: 260 },
          ],
        },
      ],
    });

    void loadRows();

    return () => {
      if (hostRef.current) hostRef.current.innerHTML = '';
      sheetRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!worksheet()) return;
    worksheet().options.columns[1].source = customers.map((customer) => customer.label);
    worksheet().options.columns[2].source = designs.map((design) => design.label);
  }, [customers, designs]);

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <div>
          <Group gap="xs">
            <HandCoins size={22} />
            <Title order={2}>Customer Prices</Title>
          </Group>
          <Text c="dimmed" size="sm" mt={4}>
            Price matrix per customer and concrete design.
          </Text>
        </div>
        <Group>
          <Button leftSection={<RefreshCw size={16} />} variant="light" onClick={loadRows} loading={loading}>
            Refresh
          </Button>
          <Button leftSection={<Save size={16} />} onClick={saveRows} loading={loading}>
            Save
          </Button>
        </Group>
      </Group>

      {error && (
        <Alert icon={<AlertCircle size={16} />} color="red" title="Database error">
          {error}
        </Alert>
      )}

      {message && <Badge variant="light">{message}</Badge>}

      <Paper withBorder radius="sm" className="sheetShell">
        <ScrollArea type="auto">
          <div ref={hostRef} className="spreadsheetHost" />
        </ScrollArea>
      </Paper>
    </Stack>
  );
}
