import { useState } from 'react';
import {
  Alert,
  Button,
  Grid,
  Group,
  NumberInput,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { AlertCircle, Database, Plus } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

const masters = [
  {
    title: 'Suppliers',
    table: 'suppliers',
    fields: [
      { key: 'name', label: 'Supplier Name', required: true },
      { key: 'contact_person', label: 'Contact Person' },
      { key: 'phone', label: 'Phone' },
      { key: 'address', label: 'Address' },
    ],
  },
  {
    title: 'Concrete Designs',
    table: 'concrete_designs',
    fields: [
      { key: 'code', label: 'Design Code', required: true },
      { key: 'description', label: 'Description' },
      { key: 'strength_psi', label: 'Strength PSI', numeric: true },
    ],
  },
  {
    title: 'Trucks',
    table: 'trucks',
    fields: [
      { key: 'truck_number', label: 'Truck Number', required: true },
      { key: 'plate_number', label: 'Plate Number' },
      { key: 'truck_type', label: 'Truck Type' },
      { key: 'capacity_cubic', label: 'Capacity m3', numeric: true },
      { key: 'current_odometer', label: 'Odometer', numeric: true },
    ],
  },
  {
    title: 'Drivers',
    table: 'drivers',
    fields: [
      { key: 'full_name', label: 'Full Name', required: true },
      { key: 'phone', label: 'Phone' },
      { key: 'license_number', label: 'License Number' },
      { key: 'license_expiry', label: 'License Expiry' },
    ],
  },
  {
    title: 'Raw Materials',
    table: 'raw_materials',
    fields: [
      { key: 'name', label: 'Material Name', required: true },
      { key: 'unit', label: 'Unit', required: true },
      { key: 'reorder_level', label: 'Reorder Level', numeric: true },
    ],
  },
  {
    title: 'Expense Categories',
    table: 'expense_categories',
    fields: [{ key: 'name', label: 'Category Name', required: true }],
  },
];

type Values = Record<string, string | number>;

export function MasterData() {
  const [values, setValues] = useState<Record<string, Values>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loadingTable, setLoadingTable] = useState('');

  async function save(table: string, requiredKeys: string[]) {
    if (!isSupabaseConfigured) {
      setError('Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env first.');
      return;
    }

    const record = values[table] ?? {};
    const missing = requiredKeys.find((key) => !String(record[key] ?? '').trim());
    if (missing) {
      setError(`Please fill the required field: ${missing}.`);
      return;
    }

    setLoadingTable(table);
    setError('');
    setMessage('');

    const cleaned = Object.fromEntries(
      Object.entries(record).map(([key, value]) => [key, value === '' ? null : value]),
    );

    const { error: insertError } = await supabase.from(table).insert(cleaned);
    setLoadingTable('');

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setValues((current) => ({ ...current, [table]: {} }));
    setMessage(`Saved a new ${table.replace(/_/g, ' ')} record.`);
  }

  return (
    <Stack gap="md">
      <div>
        <Group gap="xs">
          <Database size={22} />
          <Title order={2}>Master Data</Title>
        </Group>
        <Text c="dimmed" size="sm" mt={4}>
          Create lookup records used by the spreadsheet modules.
        </Text>
      </div>

      {!isSupabaseConfigured && (
        <Alert icon={<AlertCircle size={16} />} color="yellow" title="Supabase is not configured">
          Create a .env file from .env.example, add your project URL and anon key, then restart the dev server.
        </Alert>
      )}

      {error && (
        <Alert icon={<AlertCircle size={16} />} color="red" title="Database error">
          {error}
        </Alert>
      )}

      {message && (
        <Alert color="green" title="Saved">
          {message}
        </Alert>
      )}

      <Grid>
        {masters.map((master) => (
          <Grid.Col span={{ base: 12, md: 6 }} key={master.table}>
            <Paper withBorder radius="sm" p="md" className="masterPanel">
              <Stack gap="sm">
                <Title order={3}>{master.title}</Title>
                {master.fields.map((field) =>
                  field.numeric ? (
                    <NumberInput
                      key={field.key}
                      label={field.label}
                      value={(values[master.table]?.[field.key] as number) ?? ''}
                      onChange={(value) =>
                        setValues((current) => ({
                          ...current,
                          [master.table]: { ...current[master.table], [field.key]: value || 0 },
                        }))
                      }
                    />
                  ) : (
                    <TextInput
                      key={field.key}
                      label={field.label}
                      required={field.required}
                      value={(values[master.table]?.[field.key] as string) ?? ''}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          [master.table]: {
                            ...current[master.table],
                            [field.key]: event.currentTarget.value,
                          },
                        }))
                      }
                    />
                  ),
                )}
                <Button
                  leftSection={<Plus size={16} />}
                  onClick={() =>
                    save(
                      master.table,
                      master.fields.filter((field) => field.required).map((field) => field.key),
                    )
                  }
                  loading={loadingTable === master.table}
                >
                  Add {master.title}
                </Button>
              </Stack>
            </Paper>
          </Grid.Col>
        ))}
      </Grid>
    </Stack>
  );
}
