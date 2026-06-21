import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Grid,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { AlertCircle, RefreshCw, Save, UsersRound } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

type Customer = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  billing_address: string | null;
  site_address: string | null;
};

type CustomerForm = Omit<Customer, 'id'>;

const emptyForm: CustomerForm = {
  name: '',
  contact_person: '',
  phone: '',
  billing_address: '',
  site_address: '',
};

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadCustomers() {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError('');

    const { data, error: loadError } = await supabase
      .from('customers')
      .select('id,name,contact_person,phone,billing_address,site_address')
      .order('name');

    setLoading(false);

    if (loadError) {
      setError(loadError.message);
      return;
    }

    setCustomers(data ?? []);
  }

  async function saveCustomer() {
    if (!form.name.trim()) {
      setError('Customer name is required.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    const record = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [key, String(value ?? '').trim() || null]),
    );

    const { error: saveError } = await supabase.from('customers').insert(record);
    setLoading(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setForm(emptyForm);
    setMessage('Customer saved.');
    await loadCustomers();
  }

  useEffect(() => {
    void loadCustomers();
  }, []);

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <div>
          <Group gap="xs">
            <UsersRound size={22} />
            <Title order={2}>Customers</Title>
          </Group>
          <Text c="dimmed" size="sm" mt={4}>
            Customer records used by Sales and customer-specific pricing.
          </Text>
        </div>
        <Button leftSection={<RefreshCw size={16} />} variant="light" onClick={loadCustomers} loading={loading}>
          Refresh
        </Button>
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

      {message && <Alert color="green">{message}</Alert>}

      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper withBorder radius="sm" p="md" className="masterPanel">
            <Stack>
              <Title order={3}>New Customer</Title>
              <TextInput
                label="Customer Name"
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.currentTarget.value })}
              />
              <TextInput
                label="Contact Person"
                value={form.contact_person ?? ''}
                onChange={(event) => setForm({ ...form, contact_person: event.currentTarget.value })}
              />
              <TextInput
                label="Phone"
                value={form.phone ?? ''}
                onChange={(event) => setForm({ ...form, phone: event.currentTarget.value })}
              />
              <TextInput
                label="Billing Address"
                value={form.billing_address ?? ''}
                onChange={(event) => setForm({ ...form, billing_address: event.currentTarget.value })}
              />
              <TextInput
                label="Site Address"
                value={form.site_address ?? ''}
                onChange={(event) => setForm({ ...form, site_address: event.currentTarget.value })}
              />
              <Button leftSection={<Save size={16} />} onClick={saveCustomer} loading={loading}>
                Save Customer
              </Button>
            </Stack>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 8 }}>
          <Paper withBorder radius="sm" p="md" className="masterPanel">
            <Title order={3} mb="sm">
              Customer List
            </Title>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Contact</Table.Th>
                  <Table.Th>Phone</Table.Th>
                  <Table.Th>Site Address</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {customers.map((customer) => (
                  <Table.Tr key={customer.id}>
                    <Table.Td>{customer.name}</Table.Td>
                    <Table.Td>{customer.contact_person}</Table.Td>
                    <Table.Td>{customer.phone}</Table.Td>
                    <Table.Td>{customer.site_address}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
