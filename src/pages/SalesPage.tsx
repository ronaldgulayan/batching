import { useEffect, useMemo, useRef, useState } from 'react';
import jspreadsheet from 'jspreadsheet-ce';
import { Alert, Badge, Button, Group, Paper, ScrollArea, Stack, Text, Title } from '@mantine/core';
import { AlertCircle, ReceiptText, RefreshCw, Save } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

type Lookup = {
  id: string;
  label: string;
};

type PriceLookup = {
  customer_id: string;
  concrete_design_id: string;
  unit_price: number;
};

type SalesRecord = {
  id: string;
  sale_date: string;
  customer_id: string | null;
  manual_customer_name: string | null;
  concrete_design_id: string;
  project_site: string | null;
  cubic_volume: number;
  unit_price: number;
  payment_status: string;
  remarks: string | null;
  customers?: { name: string } | { name: string }[] | null;
  concrete_designs?: { code: string } | { code: string }[] | null;
};

const labelToId = (items: Lookup[], label: unknown) =>
  items.find((item) => item.label === String(label ?? '').trim())?.id;

const optionalText = (value: unknown) => {
  const text = String(value ?? '').trim();
  return text || null;
};

const relatedName = (value: SalesRecord['customers']) =>
  Array.isArray(value) ? value[0]?.name : value?.name;

const relatedCode = (value: SalesRecord['concrete_designs']) =>
  Array.isArray(value) ? value[0]?.code : value?.code;

export function SalesPage() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<any>(null);
  const customersRef = useRef<Lookup[]>([]);
  const designsRef = useRef<Lookup[]>([]);
  const pricesRef = useRef<PriceLookup[]>([]);
  const [customers, setCustomers] = useState<Lookup[]>([]);
  const [designs, setDesigns] = useState<Lookup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const emptyRows = useMemo(
    () => Array.from({ length: 12 }, () => ['', '', '', '', '', '', '', '', '', '', '']),
    [],
  );
  const worksheet = () => (Array.isArray(sheetRef.current) ? sheetRef.current[0] : sheetRef.current);

  function getCustomerPrice(customerLabel: unknown, designLabel: unknown) {
    const customerId = labelToId(customersRef.current, customerLabel);
    const designId = labelToId(designsRef.current, designLabel);
    if (!customerId || !designId) return null;

    return (
      pricesRef.current.find(
        (price) => price.customer_id === customerId && price.concrete_design_id === designId,
      )?.unit_price ?? null
    );
  }

  function recalculateRow(y: number) {
    const customer = worksheet()?.getValueFromCoords(2, y);
    const design = worksheet()?.getValueFromCoords(4, y);
    const savedPrice = getCustomerPrice(customer, design);

    if (savedPrice !== null) {
      worksheet()?.setValueFromCoords(7, y, savedPrice);
    }

    const volume = Number(worksheet()?.getValueFromCoords(6, y) || 0);
    const unitPrice = Number(worksheet()?.getValueFromCoords(7, y) || 0);
    worksheet()?.setValueFromCoords(8, y, volume * unitPrice);
  }

  async function loadLookups() {
    const [{ data: customerData, error: customerError }, { data: designData, error: designError }, { data: priceData, error: priceError }] =
      await Promise.all([
        supabase.from('customers').select('id,name').order('name'),
        supabase.from('concrete_designs').select('id,code').order('code'),
        supabase.from('customer_concrete_prices').select('customer_id,concrete_design_id,unit_price'),
      ]);

    if (customerError || designError || priceError) {
      throw new Error(customerError?.message || designError?.message || priceError?.message);
    }

    const nextCustomers = (customerData ?? []).map((customer) => ({
      id: customer.id,
      label: customer.name,
    }));
    const nextDesigns = (designData ?? []).map((design) => ({
      id: design.id,
      label: design.code,
    }));
    const nextPrices = (priceData ?? []).map((price) => ({
      customer_id: price.customer_id,
      concrete_design_id: price.concrete_design_id,
      unit_price: Number(price.unit_price),
    }));

    customersRef.current = nextCustomers;
    designsRef.current = nextDesigns;
    pricesRef.current = nextPrices;
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
        .from('sales_records')
        .select(
          'id,sale_date,customer_id,manual_customer_name,concrete_design_id,project_site,cubic_volume,unit_price,payment_status,remarks,customers(name),concrete_designs(code)',
        )
        .order('sale_date', { ascending: false, nullsFirst: false })
        .limit(300);

      if (loadError) throw new Error(loadError.message);

      const records = (data ?? []) as unknown as SalesRecord[];
      const rows = records.length
        ? records.map((record) => [
            record.id,
            record.sale_date,
            relatedName(record.customers) ??
              lookups.customers.find((customer) => customer.id === record.customer_id)?.label ??
              '',
            record.manual_customer_name ?? '',
            relatedCode(record.concrete_designs) ??
              lookups.designs.find((design) => design.id === record.concrete_design_id)?.label ??
              '',
            record.project_site ?? '',
            record.cubic_volume,
            record.unit_price,
            Number(record.cubic_volume || 0) * Number(record.unit_price || 0),
            record.payment_status,
            record.remarks ?? '',
          ])
        : emptyRows;

      worksheet()?.setData(rows);
      setMessage(`Loaded ${data?.length ?? 0} sales records.`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load sales.');
    } finally {
      setLoading(false);
    }
  }

  async function ensureCustomerId(customerLabel: unknown, manualName: unknown) {
    const existingId = labelToId(customersRef.current, customerLabel);
    if (existingId) return existingId;

    const name = optionalText(manualName);
    if (!name) return null;

    const { data, error: insertError } = await supabase
      .from('customers')
      .insert({ name })
      .select('id,name')
      .single();

    if (insertError) throw new Error(insertError.message);

    const customer = { id: data.id, label: data.name };
    customersRef.current = [...customersRef.current, customer];
    setCustomers(customersRef.current);
    return customer.id;
  }

  async function saveRows() {
    if (!sheetRef.current) return;
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const rows = worksheet().getData();
      const records = [];

      for (const row of rows) {
        const saleDate = optionalText(row[1]);
        const designId = labelToId(designsRef.current, row[4]);
        const customerId = await ensureCustomerId(row[2], row[3]);

        if (!saleDate || !customerId || !designId) continue;

        const customerLabel = optionalText(row[2]);
        records.push({
          id: optionalText(row[0]) || undefined,
          sale_date: saleDate,
          customer_id: customerId,
          manual_customer_name: customerLabel ? null : optionalText(row[3]),
          concrete_design_id: designId,
          project_site: optionalText(row[5]),
          cubic_volume: Number(row[6] || 0),
          unit_price: Number(row[7] || 0),
          payment_status: optionalText(row[9]) || 'unpaid',
          remarks: optionalText(row[10]),
        });
      }

      if (!records.length) {
        setMessage('No complete sales rows to save yet.');
        return;
      }

      const { error: saveError } = await supabase.from('sales_records').upsert(records, {
        onConflict: 'id',
      });

      if (saveError) throw new Error(saveError.message);

      setMessage(`Saved ${records.length} sales records.`);
      await loadRows();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save sales.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hostRef.current) return;

    hostRef.current.innerHTML = '';
    sheetRef.current = jspreadsheet(hostRef.current, {
      worksheets: [
        {
          data: emptyRows,
          minDimensions: [11, 12],
          columns: [
            { title: 'ID', type: 'text', width: 230, readOnly: true },
            { title: 'Date', type: 'calendar', width: 120 },
            { title: 'Customer', type: 'dropdown', width: 220, source: [] },
            { title: 'Manual Customer', type: 'text', width: 210 },
            { title: 'Concrete Design', type: 'dropdown', width: 180, source: [] },
            { title: 'Project Site', type: 'text', width: 190 },
            { title: 'Cubic Volume', type: 'numeric', width: 130 },
            { title: 'Unit Price', type: 'numeric', width: 130 },
            { title: 'Total Amount', type: 'numeric', width: 140, readOnly: true },
            { title: 'Status', type: 'dropdown', width: 120, source: ['unpaid', 'deposit', 'paid'] },
            { title: 'Remarks', type: 'text', width: 220 },
          ],
          onchange: (_worksheet: unknown, _cell: unknown, x: number, y: number) => {
            if ([2, 4, 6, 7].includes(Number(x))) {
              recalculateRow(Number(y));
            }
          },
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
    worksheet().options.columns[2].source = customers.map((customer) => customer.label);
    worksheet().options.columns[4].source = designs.map((design) => design.label);
  }, [customers, designs]);

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <div>
          <Group gap="xs">
            <ReceiptText size={22} />
            <Title order={2}>Sales and Billing</Title>
          </Group>
          <Text c="dimmed" size="sm" mt={4}>
            Select an existing customer or type a manual customer, then choose a design.
          </Text>
        </div>
        <Group>
          <Button leftSection={<RefreshCw size={16} />} variant="light" onClick={loadRows} loading={loading}>
            Refresh
          </Button>
          <Button leftSection={<Save size={16} />} onClick={saveRows} loading={loading}>
            Save Sales
          </Button>
        </Group>
      </Group>

      {!isSupabaseConfigured && (
        <Alert icon={<AlertCircle size={16} />} color="yellow" title="Supabase is not configured">
          Supabase credentials are missing from .env.
        </Alert>
      )}

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
