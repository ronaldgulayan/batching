import { useEffect, useState } from "react";
import {
  AppShell,
  Burger,
  Group,
  NavLink,
  Stack,
  Title,
  useMantineTheme,
  Button,
  Text,
  Badge,
  Loader,
  Center,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Building2, Wrench, LogOut, User } from "lucide-react";
import { CustomersPage } from "./pages/CustomersPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ExpensesPurchasingPage } from "./pages/ExpensesPurchasingPage";
import { GrabaPage } from "./pages/GrabaPage";
import { MaintenanceDesignsPage } from "./pages/MaintenanceDesignsPage";
import { MaintenanceSalesPeoplePage } from "./pages/MaintenanceSalesPeoplePage";
import { MaintenanceSitesPage } from "./pages/MaintenanceSitesPage";
import { SupplierTransactionsPage } from "./pages/SupplierTransactionsPage";
import { MaintenanceGrabaItemsPage } from "./pages/MaintenanceGrabaItemsPage";
import { MaintenanceGrabaTrucksPage } from "./pages/MaintenanceGrabaTrucksPage";
import { PaymentsPage } from "./pages/PaymentsPage";
import { SalesPage } from "./pages/SalesPage";
import { LoginPage } from "./pages/LoginPage";
import { isSupabaseConfigured, supabase } from "./lib/supabaseClient";
import { maintenanceNavItems, navItems } from "./data/moduleConfig";
import type { ModuleKey } from "./types";
import type { Session } from "@supabase/supabase-js";

export function App() {
  const [opened, { toggle, close }] = useDisclosure();
  const [activeModule, setActiveModule] = useState<ModuleKey>("dashboard");
  const [session, setSession] = useState<Session | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const theme = useMantineTheme();

  useEffect(() => {
    if (isSupabaseConfigured) {
      // Check initial session
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setCheckingAuth(false);
      });

      // Listen to auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
      });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      // Check simulated session
      const savedAuth = localStorage.getItem("solid_batching_auth");
      if (savedAuth === "true") {
        setSession({} as Session);
      }
      setCheckingAuth(false);
    }
  }, []);

  const handleLogout = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem("solid_batching_auth");
    setSession(null);
  };

  if (checkingAuth) {
    return (
      <Center style={{ height: "100vh", backgroundColor: "#0b0f19" }}>
        <Stack align="center" gap="md">
          <Loader size="xl" variant="dots" color="blue" />
          <Text size="sm" c="dimmed">Loading system...</Text>
        </Stack>
      </Center>
    );
  }

  if (!session) {
    return <LoginPage onLoginSuccess={() => setSession({} as Session)} />;
  }

  const userEmail = isSupabaseConfigured ? session.user?.email : "admin@solidbatching.com";

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{
        width: 292,
        breakpoint: "sm",
        collapsed: { mobile: !opened },
      }}
      padding="lg"
    >
      <AppShell.Header style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)", background: "#111622" }}>
        <Group
          h="100%"
          px="lg"
          justify="space-between"
        >
          <Group gap="md">
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
            />
            <div className="brandMark">
              <Building2
                size={24}
                color={theme.colors.blue[6]}
              />
            </div>
            <div>
              <Title
                style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px" }}
                order={1}
              >
                Solid Batching
              </Title>
            </div>
          </Group>

          {/* User Profile and Logout */}
          <Group gap="md">
            <Group gap="xs" style={{ display: "flex", alignItems: "center" }} visibleFrom="xs">
              <User size={16} color={theme.colors.gray[5]} />
              <Text size="sm" fw={500} c="gray.3">
                {userEmail}
              </Text>
              {!isSupabaseConfigured && (
                <Badge color="yellow" variant="light" size="xs">
                  Demo
                </Badge>
              )}
            </Group>

            <Button
              leftSection={<LogOut size={16} />}
              variant="subtle"
              color="red"
              size="xs"
              onClick={handleLogout}
              style={{
                borderRadius: "6px",
              }}
            >
              Sign Out
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar
        p="md"
        className="appNavbar"
        style={{ borderRight: "1px solid rgba(255, 255, 255, 0.08)", background: "#111622" }}
      >
        <Stack gap="xs">
          {navItems.map((item) => (
            <NavLink
              key={item.key}
              label={item.label}
              active={activeModule === item.key}
              leftSection={<item.icon size={18} />}
              onClick={() => {
                setActiveModule(item.key);
                close();
              }}
              className="navItem"
            />
          ))}
          <NavLink
            label="Maintenance"
            active={activeModule.startsWith("maintenance-")}
            leftSection={<Wrench size={18} />}
            defaultOpened
            className="navItem"
          >
            {maintenanceNavItems.map((item) => (
              <NavLink
                key={item.key}
                label={item.label}
                active={activeModule === item.key}
                leftSection={<item.icon size={16} />}
                onClick={() => {
                  setActiveModule(item.key);
                  close();
                }}
                className="navItem"
              />
            ))}
          </NavLink>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main style={{ backgroundColor: "#0b0f19" }}>
        <div className="page">
          {activeModule === "dashboard" && <DashboardPage />}
          {activeModule === "sales" && <SalesPage />}
          {activeModule === "payments" && <PaymentsPage />}
          {activeModule === "customers" && <CustomersPage />}
          {activeModule === "graba" && <GrabaPage />}
          {activeModule === "suppliers" && <SupplierTransactionsPage />}
          {activeModule === "maintenance-designs" && <MaintenanceDesignsPage />}
          {activeModule === "maintenance-sites" && <MaintenanceSitesPage />}
          {activeModule === "maintenance-sales" && (
            <MaintenanceSalesPeoplePage />
          )}
          {activeModule === "maintenance-graba-items" && (
            <MaintenanceGrabaItemsPage />
          )}
          {activeModule === "maintenance-graba-trucks" && (
            <MaintenanceGrabaTrucksPage />
          )}
          {activeModule === "expenses" && <ExpensesPurchasingPage />}
        </div>
      </AppShell.Main>
    </AppShell>
  );
}

