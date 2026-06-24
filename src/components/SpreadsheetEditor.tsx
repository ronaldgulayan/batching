import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  TextInput,
} from '@mantine/core';
import { AlertCircle, RefreshCw, Save } from 'lucide-react';
import type { SpreadsheetModuleConfig } from '../data/moduleConfig';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { CustomExcelTable, type ExcelColumn } from './CustomExcelTable';
import { SuggestionTextInput } from './SuggestionTextInput';

type Props = {
  config: SpreadsheetModuleConfig;
};

type DisplayRow = {
  id: string | number;
  [key: string]: string | number | null | undefined;
};

export function SpreadsheetEditor({ config }: Props) {
  const inputColumns = useMemo(() => config.columns.filter((column) => column.title !== 'ID'), [config.columns]);
  const [rows, setRows] = useState<DisplayRow[]>([]);
  const [form, setForm] = useState<Record<string, string | number>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const tableColumns = useMemo<ExcelColumn<DisplayRow>[]>(
    () =>
      config.columns.map((column, index) => ({
        key: `c${index}`,
        label: column.title,
        type: column.type === 'numeric' ? 'number' : column.type === 'calendar' ? 'date' : 'text',
        width: column.width,
        sortable: true,
      })),
    [config.columns],
  );

  function recordToDisplayRow(record: Record<string, unknown>) {
    const values = config.toRow(record);
    return {
      id: String(values[0] ?? record.id ?? crypto.randomUUID()),
      ...Object.fromEntries(values.map((value, index) => [`c${index}`, value as string | number | null | undefined])),
    };
  }

  async function loadRows() {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError('');
    setMessage('');

    const { data, error: loadError } = await supabase
      .from(config.table)
      .select('*')
      .order(config.dateColumn, { ascending: false, nullsFirst: false })
      .limit(300);

    setLoading(false);

    if (loadError) {
      setError(loadError.message);
      return;
    }

    setRows((data ?? []).map((record) => recordToDisplayRow(record as Record<string, unknown>)));
    setMessage(`Loaded ${data?.length ?? 0} records.`);
  }

  async function saveRecord() {
    if (!isSupabaseConfigured) {
      setError('Supabase credentials are missing from .env.');
      return;
    }

    const row = config.columns.map((column, index) => (index === 0 ? '' : (form[column.title] ?? '')));
    const record = config.toRecord(row);

    if (!record) {
      setError('Please complete the required fields for this module.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    const { error: saveError } = await supabase.from(config.table).insert(record);
    setLoading(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setForm({});
    setMessage('Record saved.');
    await loadRows();
  }

  useEffect(() => {
    void loadRows();
  }, [config]);

  return (
    <Stack gap="md">
      <Paper withBorder radius="sm" p="md" className="masterPanel">
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            {inputColumns.map((column) => {
              const value = form[column.title] ?? '';
              if (column.type === 'numeric') {
                return (
                  <NumberInput
                    key={column.title}
                    label={column.title}
                    value={value as number | ''}
                    onChange={(next) => setForm((current) => ({ ...current, [column.title]: Number(next) || '' }))}
                  />
                );
              }

              if (column.type === 'dropdown') {
                return (
                  <SuggestionTextInput
                    key={column.title}
                    label={column.title}
                    suggestions={column.source ?? []}
                    value={String(value || '')}
                    onValueChange={(next) => setForm((current) => ({ ...current, [column.title]: next }))}
                    submitOnEnter={() => setTimeout(() => void saveRecord(), 0)}
                  />
                );
              }

              return (
                <TextInput
                  key={column.title}
                  label={column.title}
                  type={column.type === 'calendar' ? 'date' : 'text'}
                  value={String(value ?? '')}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, [column.title]: event.currentTarget.value }))
                  }
                />
              );
            })}
          </SimpleGrid>

          <div className="formActions">
            <Button leftSection={<Save size={16} />} onClick={saveRecord} loading={loading}>
              Save
            </Button>
            <Button leftSection={<RefreshCw size={16} />} variant="light" onClick={loadRows} loading={loading}>
              Refresh
            </Button>
          </div>
        </Stack>
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

      {message && <Badge variant="light">{message}</Badge>}

      <CustomExcelTable columns={tableColumns} data={rows} />
    </Stack>
  );
}
