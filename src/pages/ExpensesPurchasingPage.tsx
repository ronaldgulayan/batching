import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Badge,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { AlertCircle, Edit3, RefreshCw, Save, Trash2, X } from "lucide-react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { CustomExcelTable, type ExcelColumn } from "../components/CustomExcelTable";
import { DateShortcutInput } from "../components/DateShortcutInput";

type ExpenseRecord = {
  id: string;
  expense_date: string;
  description: string;
  amount: number;
  remarks: string | null;
};

const tableColumns: ExcelColumn<ExpenseRecord>[] = [
  { key: "expense_date", label: "Date", type: "date", width: 130, sortable: true },
  { key: "description", label: "Description", type: "text", width: 320, sortable: true },
  { key: "amount", label: "Amount", type: "number", width: 140, sortable: true },
  { key: "remarks", label: "Remarks", type: "text", width: 220, sortable: true },
];

export function ExpensesPurchasingPage() {
  const [rows, setRows] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [form, setForm] = useState({
    expense_date: new Date().toISOString().split("T")[0],
    description: "",
    amount: "",
    remarks: "",
  });

  // Search filter
  const [search, setSearch] = useState("");
  
  // Load all expenses
  async function loadExpenses() {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError("");
    setMessage("");

    const { data, error: loadError } = await supabase
      .from("expenses")
      .select("id, expense_date, description, amount, remarks")
      .order("expense_date", { ascending: false, nullsFirst: false })
      .limit(500);

    setLoading(false);

    if (loadError) {
      setError(loadError.message);
      return;
    }

    setRows((data ?? []) as ExpenseRecord[]);
  }

  useEffect(() => {
    void loadExpenses();
  }, []);

  // Compute distinct remarks from existing values in db
  const remarksOptions = useMemo(() => {
    return Array.from(
      new Set(rows.map((row) => row.remarks).filter(Boolean) as string[])
    );
  }, [rows]);

  // Filtered rows for the table search
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((row) => {
      const dateStr = row.expense_date || "";
      const descStr = row.description || "";
      const amountStr = String(row.amount || "");
      const remarksStr = row.remarks || "";

      return (
        dateStr.toLowerCase().includes(query) ||
        descStr.toLowerCase().includes(query) ||
        amountStr.includes(query) ||
        remarksStr.toLowerCase().includes(query)
      );
    });
  }, [rows, search]);

  // Calculate total expense of current filtered view
  const totalAmount = useMemo(() => {
    return filteredRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  }, [filteredRows]);

  // Handle Form Submission
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.expense_date) {
      setError("Date is required.");
      return;
    }
    if (!form.description.trim()) {
      setError("Description is required.");
      return;
    }
    const amountNum = Number(form.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Amount must be a positive number.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    const record = {
      expense_date: form.expense_date,
      description: form.description.trim(),
      amount: amountNum,
      remarks: form.remarks.trim() || null,
    };

    let query;
    if (editingId) {
      query = supabase.from("expenses").update(record).eq("id", editingId);
    } else {
      query = supabase.from("expenses").insert(record);
    }

    const { error: saveError } = await query;
    setLoading(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setMessage(editingId ? "Expense updated successfully." : "Expense saved successfully.");
    resetForm();
    await loadExpenses();
  }

  // Populate form for editing
  function startEdit(row: ExpenseRecord) {
    setEditingId(row.id);
    setForm({
      expense_date: row.expense_date,
      description: row.description,
      amount: String(row.amount),
      remarks: row.remarks ?? "",
    });
    setError("");
    setMessage("");
  }

  // Handle Delete
  async function handleDelete(row: ExpenseRecord) {
    if (!window.confirm("Are you sure you want to delete this expense?")) {
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    const { error: deleteError } = await supabase
      .from("expenses")
      .delete()
      .eq("id", row.id);

    setLoading(false);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setMessage("Expense deleted successfully.");
    if (editingId === row.id) {
      resetForm();
    }
    await loadExpenses();
  }

  // Reset Form
  function resetForm() {
    setEditingId(null);
    setForm({
      expense_date: new Date().toISOString().split("T")[0],
      description: "",
      amount: "",
      remarks: "",
    });
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Title order={2}>Expenses</Title>
        <Button
          leftSection={<RefreshCw size={16} />}
          variant="light"
          onClick={loadExpenses}
          loading={loading}
        >
          Refresh
        </Button>
      </Group>

      {/* Input Form Panel */}
      <Paper withBorder radius="sm" p="md" className="masterPanel">
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <Text size="sm" fw={600} c="dimmed">
              {editingId ? "EDIT EXPENSE RECORD" : "CREATE NEW EXPENSE RECORD"}
            </Text>

            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
              <DateShortcutInput
                label="Date"
                required
                value={form.expense_date}
                onChange={(val) =>
                  setForm((current) => ({ ...current, expense_date: val }))
                }
              />
              <TextInput
                label="Description"
                placeholder="Enter description"
                required
                value={form.description}
                onChange={(e) =>
                  setForm((current) => ({ ...current, description: e.target.value }))
                }
              />
              <TextInput
                label="Amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                required
                value={form.amount}
                onChange={(e) =>
                  setForm((current) => ({ ...current, amount: e.target.value }))
                }
              />
              <Autocomplete
                label="Remarks"
                placeholder="Select or type a remark"
                data={remarksOptions}
                value={form.remarks}
                onChange={(val) =>
                  setForm((current) => ({ ...current, remarks: val }))
                }
              />
            </SimpleGrid>

            <Group justify="flex-start" gap="sm">
              <Button type="submit" leftSection={<Save size={16} />} loading={loading}>
                {editingId ? "Update" : "Save"}
              </Button>
              {editingId && (
                <Button
                  variant="subtle"
                  color="gray"
                  leftSection={<X size={16} />}
                  onClick={resetForm}
                >
                  Cancel
                </Button>
              )}
            </Group>
          </Stack>
        </form>
      </Paper>

      {/* Messages */}
      {!isSupabaseConfigured && (
        <Alert icon={<AlertCircle size={16} />} color="yellow" title="Supabase Not Configured">
          Supabase credentials are missing from .env.
        </Alert>
      )}
      {error && (
        <Alert icon={<AlertCircle size={16} />} color="red" title="Error">
          {error}
        </Alert>
      )}
      {message && (
        <Alert color="green" title="Success">
          {message}
        </Alert>
      )}

      {/* Expenses Table Panel */}
      <Paper withBorder radius="sm" p="md" className="masterPanel">
        <Group justify="space-between" mb="md" align="center">
          <Group gap="sm" align="center">
            <Badge variant="outline">Expenses List</Badge>
            <Badge color="blue" variant="light">
              Total Filtered: ₱
              {totalAmount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Badge>
          </Group>
          <Badge variant="light">
            {filteredRows.length} of {rows.length} records
          </Badge>
        </Group>

        <TextInput
          placeholder="Search by description, date, amount, or remarks..."
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          mb="md"
        />

        <CustomExcelTable
          columns={tableColumns}
          data={filteredRows}
          onEditClick={(row) => startEdit(row)}
          onDeleteClick={(row) => handleDelete(row)}
          renderRowActions={(row) => (
            <Group gap="xs" justify="center">
              <Button
                size="xs"
                variant="subtle"
                leftSection={<Edit3 size={14} />}
                onClick={() => startEdit(row)}
              >
                Edit
              </Button>
              <Button
                size="xs"
                variant="subtle"
                color="red"
                leftSection={<Trash2 size={14} />}
                onClick={() => handleDelete(row)}
              >
                Delete
              </Button>
            </Group>
          )}
        />
      </Paper>
    </Stack>
  );
}
