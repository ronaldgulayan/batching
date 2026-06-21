import { useEffect, useMemo, useRef, useState } from 'react';
import jspreadsheet from 'jspreadsheet-ce';
import {
  Alert,
  Badge,
  Button,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { AlertCircle, RefreshCw, Save } from 'lucide-react';
import type { SpreadsheetModuleConfig } from '../data/moduleConfig';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

type Props = {
  config: SpreadsheetModuleConfig;
};

export function SpreadsheetEditor({ config }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  const emptyRows = useMemo(
    () => Array.from({ length: 12 }, () => Array.from({ length: config.columns.length }, () => '')),
    [config.columns.length],
  );

  const worksheet = () => (Array.isArray(sheetRef.current) ? sheetRef.current[0] : sheetRef.current);

  async function loadRows() {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError('');
    setMessage('');

    const { data, error: loadError } = await supabase
      .from(config.table)
      .select('*')
      .order(config.dateColumn, { ascending: false, nullsFirst: false })
      .limit(200);

    setLoading(false);

    if (loadError) {
      setError(loadError.message);
      return;
    }

    const rows = data?.length ? data.map(config.toRow) : emptyRows;
    worksheet()?.setData(rows);
    setMessage(`Loaded ${data?.length ?? 0} records.`);
  }

  async function saveRows() {
    if (!sheetRef.current) return;
    if (!isSupabaseConfigured) {
      setError('Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env first.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    const records = worksheet()
      .getData()
      .map(config.toRecord)
      .filter(Boolean);

    if (!records.length) {
      setLoading(false);
      setMessage('No complete rows to save yet.');
      return;
    }

    const { error: saveError } = await supabase.from(config.table).upsert(records, {
      onConflict: 'id',
    });

    setLoading(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setMessage(`Saved ${records.length} records.`);
    await loadRows();
  }

  useEffect(() => {
    if (!hostRef.current) return;

    hostRef.current.innerHTML = '';
    sheetRef.current = jspreadsheet(hostRef.current, {
      worksheets: [
        {
          data: emptyRows,
          minDimensions: [config.columns.length, 12],
          columns: config.columns,
        },
      ],
    });

    void loadRows();

    return () => {
      if (hostRef.current) hostRef.current.innerHTML = '';
      sheetRef.current = null;
    };
  }, [config, emptyRows]);

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <div>
          <Group gap="xs">
            <config.icon size={22} />
            <Title order={2}>{config.title}</Title>
          </Group>
          <Text c="dimmed" size="sm" mt={4}>
            Spreadsheet entry for {config.table.replace(/_/g, ' ')}.
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

      {message && <Badge variant="light">{message}</Badge>}

      <Paper withBorder radius="sm" className="sheetShell">
        <ScrollArea type="auto">
          <div ref={hostRef} className="spreadsheetHost" />
        </ScrollArea>
      </Paper>
    </Stack>
  );
}
