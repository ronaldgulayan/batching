import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, NumberInput, Paper, SimpleGrid, Stack, TextInput } from '@mantine/core';
import { AlertCircle, Edit3, RefreshCw, Save, X } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { CustomExcelTable, type ExcelColumn } from './CustomExcelTable';

type FieldConfig = {
  key: string;
  label: string;
  numeric?: boolean;
  required?: boolean;
};

type Props = {
  table: string;
  orderBy: string;
  fields: FieldConfig[];
  columns: readonly ExcelColumn<RecordRow>[];
  uniqueKey?: string;
};

type RecordRow = {
  id: string | number;
  [key: string]: string | number | null | undefined;
};

export function MaintenanceLookupPage({ table, orderBy, fields, columns, uniqueKey }: Props) {
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [form, setForm] = useState<Record<string, string | number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState<string | number | null>(null);

  const selectColumns = useMemo(() => ['id', ...fields.map((field) => field.key)].join(','), [fields]);

  async function loadRows() {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError('');
    setMessage('');

    const { data, error: loadError } = await supabase.from(table).select(selectColumns).order(orderBy);
    setLoading(false);

    if (loadError) {
      setError(loadError.message);
      return;
    }

    setRows(((data ?? []) as unknown) as RecordRow[]);
    setMessage(`Loaded ${data?.length ?? 0} records.`);
  }

  async function saveRecord() {
    const missing = fields.find((field) => field.required && !String(form[field.key] ?? '').trim());
    if (missing) {
      setError(`${missing.label} is required.`);
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    if (uniqueKey) {
      const value = String(form[uniqueKey] ?? '').trim().toLowerCase();
      const fieldLabel = fields.find((f) => f.key === uniqueKey)?.label || uniqueKey;

      const duplicateExists = rows.some((row) => {
        if (editingId && row.id === editingId) return false;
        const rowValue = String(row[uniqueKey] ?? '').trim().toLowerCase();
        return rowValue === value;
      });

      if (duplicateExists) {
        setError(`${fieldLabel} "${String(form[uniqueKey] ?? '').trim()}" already exists.`);
        setLoading(false);
        return;
      }
    }

    const record = Object.fromEntries(
      fields.map((field) => {
        const value = form[field.key];
        if (field.numeric) return [field.key, Number(value || 0)];
        return [field.key, String(value ?? '').trim() || null];
      }),
    );

    const query = editingId
      ? supabase.from(table).update(record).eq('id', editingId)
      : uniqueKey
        ? supabase.from(table).upsert(record, { onConflict: uniqueKey, ignoreDuplicates: true })
        : supabase.from(table).insert(record);
    const { error: saveError } = await query;
    setLoading(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setForm({});
    setEditingId(null);
    setMessage(editingId ? 'Updated.' : 'Saved.');
    await loadRows();
  }

  function startEdit(row: RecordRow) {
    setEditingId(row.id);
    setForm(
      Object.fromEntries(
        fields.map((field) => {
          const value = row[field.key];
          return [field.key, value === null || value === undefined ? '' : value];
        }),
      ),
    );
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({});
  }

  useEffect(() => {
    void loadRows();
  }, [table]);

  return (
    <Stack gap="md">
      <Paper withBorder radius="sm" p="md" className="masterPanel">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void saveRecord();
          }}
        >
          <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            {fields.map((field) =>
              field.numeric ? (
                <NumberInput
                  key={field.key}
                  label={field.label}
                  value={(form[field.key] as number) ?? ''}
                  onChange={(value) => setForm((current) => ({ ...current, [field.key]: Number(value) || '' }))}
                />
              ) : (
                <TextInput
                  key={field.key}
                  label={field.label}
                  required={field.required}
                  value={String(form[field.key] ?? '')}
                  onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.currentTarget.value }))}
                />
              ),
            )}
          </SimpleGrid>
          <div className="formActions">
            <Button leftSection={<Save size={16} />} type="submit" loading={loading}>
              {editingId ? 'Update' : 'Save'}
            </Button>
            {editingId && (
              <Button leftSection={<X size={16} />} variant="light" color="gray" onClick={cancelEdit}>
                Cancel
              </Button>
            )}
            <Button leftSection={<RefreshCw size={16} />} variant="light" onClick={loadRows} loading={loading}>
              Refresh
            </Button>
          </div>
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

      {message && <Badge variant="light">{message}</Badge>}

      <CustomExcelTable
        columns={columns}
        data={rows}
        onEditClick={(row) => startEdit(row)}
        renderRowActions={(row) => (
          <Button size="xs" variant="subtle" leftSection={<Edit3 size={14} />} onClick={() => startEdit(row)}>
            Edit
          </Button>
        )}
      />
    </Stack>
  );
}
