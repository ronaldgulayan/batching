import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Group,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  TextInput,
} from '@mantine/core';
import { AlertCircle, RefreshCw, Save } from 'lucide-react';
import { CustomExcelTable, type ExcelColumn } from '../components/CustomExcelTable';
import { SuggestionTextInput } from '../components/SuggestionTextInput';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

type Lookup = {
  id: string;
  label: string;
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
  total_amount: number;
  payment_status: string;
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
  total_amount: number;
  payment_status: string;
  customers?: { name: string } | { name: string }[] | null;
  concrete_designs?: { code: string } | { code: string }[] | null;
};

type SaleForm = {
  sale_date: string;
  sale_or_number: number | '';
  client_name: string;
  concrete_design_id: string | null;
  design_label: string;
  project_site: string;
  cubic_volume: number | '';
  unit_price: number | '';
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm: SaleForm = {
  sale_date: today(),
  sale_or_number: '',
  client_name: '',
  concrete_design_id: null,
  design_label: '',
  project_site: '',
  cubic_volume: '',
  unit_price: '',
};

const relatedName = (value: SalesRecord['customers']) =>
  Array.isArray(value) ? value[0]?.name : value?.name;

const relatedCode = (value: SalesRecord['concrete_designs']) =>
  Array.isArray(value) ? value[0]?.code : value?.code;

const saleColumns: ExcelColumn<SaleRow>[] = [
  { key: 'sale_or_number', label: 'OR No', type: 'number', width: 100, sortable: true },
  { key: 'sale_date', label: 'Date', type: 'date', width: 120, sortable: true },
  { key: 'client_name', label: 'Client Name', width: 220, sortable: true },
  { key: 'design', label: 'Design', width: 140, sortable: true },
  { key: 'site', label: 'Site', width: 220, sortable: true },
  { key: 'cubic_volume', label: 'Cubic', type: 'number', width: 110, sortable: true },
  { key: 'unit_price', label: 'Price', type: 'number', width: 130, sortable: true },
  { key: 'total_amount', label: 'Total', type: 'number', width: 140, sortable: true },
  { key: 'payment_status', label: 'Payment', width: 120, sortable: true },
];

export function SalesPage() {
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [customers, setCustomers] = useState<Lookup[]>([]);
  const [designs, setDesigns] = useState<Lookup[]>([]);
  const [sites, setSites] = useState<Lookup[]>([]);
  const [form, setForm] = useState<SaleForm>(emptyForm);
  const [nextOrNumber, setNextOrNumber] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const total = useMemo(() => Number(form.cubic_volume || 0) * Number(form.unit_price || 0), [
    form.cubic_volume,
    form.unit_price,
  ]);

  async function loadLookups() {
    const [{ data: customerData, error: customerError }, { data: designData, error: designError }, siteResult] =
      await Promise.all([
        supabase.from('customers').select('id,name').order('name'),
        supabase.from('concrete_designs').select('id,code').order('code'),
        supabase.from('project_sites').select('id,name').order('name'),
      ]);

    if (customerError || designError || siteResult.error) {
      throw new Error(customerError?.message || designError?.message || siteResult.error?.message);
    }

    setCustomers((customerData ?? []).map((customer) => ({ id: customer.id, label: customer.name })));
    setDesigns((designData ?? []).map((design) => ({ id: design.id, label: design.code })));
    setSites((siteResult.data ?? []).map((site) => ({ id: site.id, label: site.name })));
  }

  async function loadRows() {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError('');
    setMessage('');

    try {
      await loadLookups();
      const { data, error: loadError } = await supabase
        .from('sales_records')
        .select(
          'id,sale_or_number,sale_date,customer_id,manual_customer_name,project_site,cubic_volume,unit_price,total_amount,payment_status,customers(name),concrete_designs(code)',
        )
        .order('sale_or_number', { ascending: false })
        .limit(300);

      if (loadError) throw new Error(loadError.message);

      const records = (data ?? []) as unknown as SalesRecord[];
      const maxOrNumber = records.reduce((max, record) => Math.max(max, Number(record.sale_or_number || 0)), 0);
      const nextNumber = maxOrNumber + 1;

      setNextOrNumber(nextNumber);
      setForm((current) => ({ ...current, sale_or_number: current.sale_or_number || nextNumber }));
      setRows(
        records.map((record) => ({
          id: record.id,
          sale_or_number: Number(record.sale_or_number || 0),
          sale_date: record.sale_date,
          client_name: relatedName(record.customers) ?? record.manual_customer_name ?? '',
          design: relatedCode(record.concrete_designs) ?? '',
          site: record.project_site ?? '',
          cubic_volume: Number(record.cubic_volume || 0),
          unit_price: Number(record.unit_price || 0),
          total_amount: Number(record.total_amount || 0),
          payment_status: record.payment_status,
        })),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load sales.');
    } finally {
      setLoading(false);
    }
  }

  async function ensureCustomerId(clientName: string) {
    const cleaned = clientName.trim();
    if (!cleaned) return null;

    const existing = customers.find((customer) => customer.label.toLowerCase() === cleaned.toLowerCase());
    if (existing) return existing.id;

    const { data, error: insertError } = await supabase.from('customers').insert({ name: cleaned }).select('id,name').single();
    if (insertError) throw new Error(insertError.message);

    setCustomers((current) => [...current, { id: data.id, label: data.name }]);
    return data.id;
  }

  async function ensureSiteName(siteName: string) {
    const cleaned = siteName.trim();
    if (!cleaned) return null;

    const existing = sites.find((site) => site.label.toLowerCase() === cleaned.toLowerCase());
    if (existing) return existing.label;

    const { data, error: insertError } = await supabase
      .from('project_sites')
      .insert({ name: cleaned })
      .select('id,name')
      .single();
    if (insertError) throw new Error(insertError.message);

    setSites((current) => [...current, { id: data.id, label: data.name }]);
    return data.name;
  }

  function designIdFromLabel(label: string) {
    return designs.find((design) => design.label.toLowerCase() === label.trim().toLowerCase())?.id ?? null;
  }

  async function saveSale() {
    if (!isSupabaseConfigured) {
      setError('Supabase credentials are missing from .env.');
      return;
    }

    const orNumber = Number(form.sale_or_number || 0);
    if (orNumber < nextOrNumber) {
      setError(`OR No must be ${nextOrNumber} or higher. Used or skipped numbers cannot be reused.`);
      return;
    }

    const designId = form.concrete_design_id ?? designIdFromLabel(form.design_label);
    if (!form.sale_date || !form.client_name.trim() || !designId || !form.project_site.trim()) {
      setError('Date, Client Name, Design, Site, Cubic, and Price are required.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const customerId = await ensureCustomerId(form.client_name);
      if (!customerId) throw new Error('Client Name is required.');
      const siteName = await ensureSiteName(form.project_site);
      if (!siteName) throw new Error('Site is required.');

      const { error: insertError } = await supabase.from('sales_records').insert({
        sale_or_number: orNumber,
        sale_date: form.sale_date,
        customer_id: customerId,
        manual_customer_name: null,
        concrete_design_id: designId,
        project_site: siteName,
        cubic_volume: Number(form.cubic_volume || 0),
        unit_price: Number(form.unit_price || 0),
        payment_status: 'unpaid',
      });

      if (insertError) throw new Error(insertError.message);

      setMessage(`Saved sale OR No ${orNumber}.`);
      setForm({ ...emptyForm, sale_or_number: orNumber + 1 });
      await loadRows();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save sale.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRows();
  }, []);

  return (
    <Stack gap="md">
      <Paper withBorder radius="sm" p="md" className="masterPanel">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void saveSale();
          }}
        >
          <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            <TextInput
              label="Date"
              type="date"
              value={form.sale_date}
              onChange={(event) => setForm((current) => ({ ...current, sale_date: event.currentTarget.value }))}
            />
            <NumberInput
              label="OR No"
              min={nextOrNumber}
              value={form.sale_or_number}
              onChange={(value) => setForm((current) => ({ ...current, sale_or_number: Number(value) || '' }))}
            />
            <SuggestionTextInput
              label="Client Name"
              value={form.client_name}
              suggestions={customers.map((customer) => customer.label)}
              onValueChange={(value) => setForm((current) => ({ ...current, client_name: value }))}
              submitOnEnter={() => setTimeout(() => void saveSale(), 0)}
            />
            <SuggestionTextInput
              label="Design"
              value={form.design_label}
              suggestions={designs.map((design) => design.label)}
              onValueChange={(value) =>
                setForm((current) => ({ ...current, design_label: value, concrete_design_id: designIdFromLabel(value) }))
              }
              onCommit={(value) =>
                setForm((current) => ({ ...current, design_label: value, concrete_design_id: designIdFromLabel(value) }))
              }
              submitOnEnter={() => setTimeout(() => void saveSale(), 0)}
            />
            <SuggestionTextInput
              label="Site"
              value={form.project_site}
              suggestions={sites.map((site) => site.label)}
              onValueChange={(value) => setForm((current) => ({ ...current, project_site: value }))}
              submitOnEnter={() => setTimeout(() => void saveSale(), 0)}
            />
            <NumberInput
              label="Cubic"
              min={0}
              value={form.cubic_volume}
              onChange={(value) => setForm((current) => ({ ...current, cubic_volume: Number(value) || '' }))}
            />
            <NumberInput
              label="Price"
              min={0}
              value={form.unit_price}
              onChange={(value) => setForm((current) => ({ ...current, unit_price: Number(value) || '' }))}
            />
            <NumberInput label="Total" value={total} readOnly thousandSeparator="," decimalScale={2} />
          </SimpleGrid>

          <Group justify="space-between">
            <Group>
              <Button leftSection={<Save size={16} />} type="submit" loading={loading}>
                Save Sale
              </Button>
              <Button leftSection={<RefreshCw size={16} />} variant="light" onClick={loadRows} loading={loading}>
                Refresh
              </Button>
            </Group>
            <Badge variant="light">Next OR No: {nextOrNumber}</Badge>
          </Group>
          </Stack>
        </form>
      </Paper>

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

      {message && <Alert color="green">{message}</Alert>}

      <CustomExcelTable columns={saleColumns} data={rows} />
    </Stack>
  );
}
