import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  LoadingOverlay,
  Modal,
  Paper,
  PasswordInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  ActionIcon,
  Tooltip,
  Card,
  SimpleGrid,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  AlertCircle,
  Edit3,
  Plus,
  RefreshCw,
  Trash2,
  UserPlus,
  ShieldCheck,
  Search,
  CheckCircle,
  Check,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

export type UserProfileRow = {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "staff" | string;
  created_at?: string;
  updated_at?: string;
};

const DEFAULT_DEMO_USERS: UserProfileRow[] = [
  {
    id: "usr-admin-01",
    email: "admin@solidbatching.com",
    full_name: "System Administrator",
    role: "admin",
    created_at: new Date().toISOString(),
  },
  {
    id: "usr-staff-01",
    email: "dispatcher@solidbatching.com",
    full_name: "Juan Dela Cruz",
    role: "staff",
    created_at: new Date().toISOString(),
  },
];

export function MaintenanceUsersPage() {
  const [users, setUsers] = useState<UserProfileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [opened, { open, close }] = useDisclosure(false);
  const [editingUser, setEditingUser] = useState<UserProfileRow | null>(null);

  // Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("123456789");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<string>("staff");
  const [submitting, setSubmitting] = useState(false);

  // Load Users
  async function loadUsers() {
    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      if (isSupabaseConfigured) {
        // Try fetching profiles table
        const { data, error: loadError } = await supabase
          .from("profiles")
          .select("id, email, full_name, role, created_at, updated_at")
          .order("created_at", { ascending: false });

        if (loadError) {
          throw loadError;
        }

        setUsers(data as UserProfileRow[]);
      } else {
        // Local simulation fallback
        const saved = localStorage.getItem("solid_batching_users_list");
        if (saved) {
          setUsers(JSON.parse(saved));
        } else {
          localStorage.setItem("solid_batching_users_list", JSON.stringify(DEFAULT_DEMO_USERS));
          setUsers(DEFAULT_DEMO_USERS);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load users.");
      // Fallback to local storage if DB query fails or profiles table is not yet migrated
      const saved = localStorage.getItem("solid_batching_users_list");
      if (saved) {
        setUsers(JSON.parse(saved));
      } else {
        setUsers(DEFAULT_DEMO_USERS);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setEmail("");
    setPassword("123456789");
    setFullName("");
    setRole("staff");
    setError("");
    open();
  };

  const handleOpenEditModal = (user: UserProfileRow) => {
    setEditingUser(user);
    setEmail(user.email);
    setPassword(""); // Leave password blank on edit unless changing
    setFullName(user.full_name || "");
    setRole(user.role || "staff");
    setError("");
    open();
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!email.trim() || !fullName.trim()) {
      setError("Email and Full Name are required.");
      return;
    }

    if (!editingUser && !password.trim()) {
      setError("Password is required for new user creation.");
      return;
    }

    setSubmitting(true);

    try {
      if (isSupabaseConfigured) {
        if (editingUser) {
          // Update existing user via RPC or table update
          const { data: rpcRes, error: rpcErr } = await supabase.rpc("admin_update_user", {
            p_user_id: editingUser.id,
            p_full_name: fullName.trim(),
            p_role: role,
          });

          if (rpcErr) {
            // Fallback to direct profiles table update
            const { error: directErr } = await supabase
              .from("profiles")
              .update({
                full_name: fullName.trim(),
                role,
                updated_at: new Date().toISOString(),
              })
              .eq("id", editingUser.id);

            if (directErr) throw directErr;
          } else if (rpcRes && rpcRes.success === false) {
            throw new Error(rpcRes.error || "Failed to update user.");
          }

          setSuccessMsg(`User ${email} updated successfully.`);
        } else {
          // Create new user via RPC admin_create_user or supabase auth
          const { data: rpcRes, error: rpcErr } = await supabase.rpc("admin_create_user", {
            p_email: email.trim(),
            p_password: password,
            p_full_name: fullName.trim(),
            p_role: role,
          });

          if (rpcErr) {
            // Try standard auth sign up fallback if RPC isn't set up yet
            const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
              email: email.trim(),
              password: password,
              options: {
                data: {
                  full_name: fullName.trim(),
                  role: role,
                },
              },
            });

            if (signUpErr) throw signUpErr;

            if (signUpData.user) {
              await supabase.from("profiles").upsert({
                id: signUpData.user.id,
                email: email.trim(),
                full_name: fullName.trim(),
                role: role,
              });
            }
          } else if (rpcRes && rpcRes.success === false) {
            throw new Error(rpcRes.error || "Failed to create user.");
          }

          setSuccessMsg(`New user ${email} created successfully.`);
        }
        await loadUsers();
      } else {
        // Local state mutation for offline / demo mode
        let updatedList: UserProfileRow[];
        if (editingUser) {
          updatedList = users.map((u) =>
            u.id === editingUser.id
              ? { ...u, full_name: fullName.trim(), role, updated_at: new Date().toISOString() }
              : u
          );
          setSuccessMsg(`User ${email} updated successfully (local).`);
        } else {
          const newRow: UserProfileRow = {
            id: `usr-local-${Date.now()}`,
            email: email.trim(),
            full_name: fullName.trim(),
            role,
            created_at: new Date().toISOString(),
          };
          updatedList = [newRow, ...users];
          setSuccessMsg(`User ${email} added successfully (local).`);
        }
        localStorage.setItem("solid_batching_users_list", JSON.stringify(updatedList));
        setUsers(updatedList);
      }

      close();
    } catch (err: any) {
      setError(err.message || "Operation failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (user: UserProfileRow) => {
    if (!window.confirm(`Are you sure you want to delete user ${user.email}?`)) {
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      if (isSupabaseConfigured) {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc("admin_delete_user", {
          p_user_id: user.id,
        });

        if (rpcErr) {
          const { error: directErr } = await supabase.from("profiles").delete().eq("id", user.id);
          if (directErr) throw directErr;
        } else if (rpcRes && rpcRes.success === false) {
          throw new Error(rpcRes.error || "Failed to delete user.");
        }
        setSuccessMsg(`User ${user.email} removed.`);
        await loadUsers();
      } else {
        const updatedList = users.filter((u) => u.id !== user.id);
        localStorage.setItem("solid_batching_users_list", JSON.stringify(updatedList));
        setUsers(updatedList);
        setSuccessMsg(`User ${user.email} removed (local).`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete user.");
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      (u.full_name && u.full_name.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q))
    );
  });

  const getRoleBadgeColor = (r: string) => {
    switch (r?.toLowerCase()) {
      case "admin":
        return "red";
      case "manager":
        return "orange";
      case "staff":
        return "blue";
      default:
        return "gray";
    }
  };

  return (
    <Stack gap="lg">
      <LoadingOverlay
        visible={loading}
        zIndex={1000}
        transitionProps={{ duration: 0 }}
        overlayProps={{ opacity: 0.35, blur: 0.5 }}
        loaderProps={{ color: "blue", type: "bars", size: "lg" }}
        style={{ position: "fixed", inset: 0 }}
      />
      {/* Top Header Card */}
      <Paper withBorder radius="md" p="md" className="masterPanel">
        <Group justify="space-between" align="center">
          <div>
            <Group gap="xs">
              <ShieldCheck size={24} color="#3b82f6" />
              <Title order={2} style={{ fontSize: "20px", fontWeight: 700 }}>
                User Maintenance
              </Title>
            </Group>
            <Text size="sm" c="dimmed" mt={2}>
              Manage system accounts, user credentials, and operational access roles.
            </Text>
          </div>
          <Group gap="sm">
            <Button
              leftSection={<RefreshCw size={16} />}
              variant="light"
              onClick={loadUsers}
              loading={loading}
            >
              Refresh
            </Button>
            <Button
              leftSection={<UserPlus size={16} />}
              variant="gradient"
              gradient={{ from: "blue.6", to: "indigo.6" }}
              onClick={handleOpenAddModal}
            >
              Add New User
            </Button>
          </Group>
        </Group>
      </Paper>

      {/* Notifications */}
      {error && (
        <Alert icon={<AlertCircle size={16} />} color="red" title="Notice">
          {error}
        </Alert>
      )}
      {successMsg && (
        <Alert icon={<CheckCircle size={16} />} color="green" title="Success">
          {successMsg}
        </Alert>
      )}

      {/* Search & Statistics Filter Bar */}
      <Paper withBorder radius="md" p="md" style={{ backgroundColor: "rgba(15, 20, 30, 0.5)" }}>
        <Group justify="space-between">
          <TextInput
            placeholder="Search by name, email, or role..."
            leftSection={<Search size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            style={{ width: "320px" }}
          />
          <Group gap="md">
            <Badge variant="dot" color="blue" size="lg">
              Total Users: {users.length}
            </Badge>
            <Badge variant="dot" color="red" size="lg">
              Admins: {users.filter((u) => u.role === "admin").length}
            </Badge>
            <Badge variant="dot" color="blue" size="lg">
              Staffs: {users.filter((u) => u.role === "staff" || !u.role).length}
            </Badge>
          </Group>
        </Group>
      </Paper>

      {/* Users Data Table */}
      <Paper withBorder radius="md" p="0" style={{ overflow: "hidden" }}>
        <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
          <Table.Thead style={{ backgroundColor: "rgba(255, 255, 255, 0.03)" }}>
            <Table.Tr>
              <Table.Th>User Account</Table.Th>
              <Table.Th>Email Address</Table.Th>
              <Table.Th>Access Role</Table.Th>
              <Table.Th>Date Added</Table.Th>
              <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredUsers.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5} style={{ textAlign: "center", padding: "30px" }}>
                  <Text c="dimmed" size="sm">
                    No users found matching your search.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              filteredUsers.map((user) => (
                <Table.Tr key={user.id}>
                  <Table.Td>
                    <Group gap="xs">
                      <ShieldCheck size={18} color="#94a3b8" />
                      <div>
                        <Text size="sm" fw={600}>
                          {user.full_name || "Unnamed User"}
                        </Text>
                        <Text size="xs" c="dimmed">
                          ID: {user.id.slice(0, 18)}...
                        </Text>
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ fontFamily: "monospace" }}>
                      {user.email}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={getRoleBadgeColor(user.role)} variant="light" radius="sm">
                      {(user.role || "staff").toUpperCase()}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString()
                        : "N/A"}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: "right" }}>
                    <Group gap="xs" justify="flex-end">
                      <Tooltip label="Edit User Profile & Role">
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={() => handleOpenEditModal(user)}
                        >
                          <Edit3 size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Delete User">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => handleDeleteUser(user)}
                        >
                          <Trash2 size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      {/* Add / Edit User Modal */}
      <Modal
        opened={opened}
        onClose={close}
        title={
          <Group gap="xs">
            <UserPlus size={20} color="#3b82f6" />
            <Text fw={700}>{editingUser ? "Edit User Account" : "Add New System User"}</Text>
          </Group>
        }
        centered
        radius="md"
        size="md"
      >
        <form onSubmit={handleSaveUser}>
          <Stack gap="md" mt="xs">
            {error && (
              <Alert icon={<AlertCircle size={16} />} color="red">
                {error}
              </Alert>
            )}

            <TextInput
              label="Full Name"
              placeholder="e.g. Juan Dela Cruz"
              required
              value={fullName}
              onChange={(e) => setFullName(e.currentTarget.value)}
            />

            <TextInput
              label="Email Address"
              placeholder="user@solidbatching.com"
              required
              disabled={!!editingUser} // Email cannot be changed once created in Supabase Auth
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
            />

            {!editingUser && (
              <PasswordInput
                label="Password"
                placeholder="Enter password for initial login"
                required
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
              />
            )}

            <Select
              label="Role"
              data={[
                { value: "admin", label: "Admin" },
                { value: "staff", label: "Staff" },
              ]}
              value={role}
              onChange={(val) => setRole(val || "staff")}
              checkIconPosition="right"
              renderOption={({ option, checked }) => (
                <Group flex="1" justify="space-between" align="center" style={{ width: "100%" }}>
                  <Text size="sm">{option.label}</Text>
                  {checked && <Check size={16} color="#3b82f6" />}
                </Group>
              )}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="light" color="gray" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" loading={submitting} variant="gradient" gradient={{ from: "blue.6", to: "indigo.6" }}>
                {editingUser ? "Update User" : "Create User"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
