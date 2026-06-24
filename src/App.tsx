import { useState } from "react";
import {
  AppShell,
  Burger,
  Group,
  NavLink,
  Stack,
  Title,
  useMantineTheme,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Building2, Wrench } from "lucide-react";
import { CustomersPage } from "./pages/CustomersPage";
import { ExpensesPurchasingPage } from "./pages/ExpensesPurchasingPage";
import { GrabaPage } from "./pages/GrabaPage";
import { MaintenanceDesignsPage } from "./pages/MaintenanceDesignsPage";
import { MaintenanceSalesPeoplePage } from "./pages/MaintenanceSalesPeoplePage";
import { MaintenanceSitesPage } from "./pages/MaintenanceSitesPage";
import { MaintenanceSuppliersPage } from "./pages/MaintenanceSuppliersPage";
import { PaymentsPage } from "./pages/PaymentsPage";
import { SalesPage } from "./pages/SalesPage";
import { maintenanceNavItems, navItems } from "./data/moduleConfig";
import type { ModuleKey } from "./types";

export function App() {
  const [opened, { toggle, close }] = useDisclosure();
  const [activeModule, setActiveModule] = useState<ModuleKey>("sales");
  const theme = useMantineTheme();

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{
        width: 292,
        breakpoint: "sm",
        collapsed: { mobile: !opened },
      }}
      padding='lg'
    >
      <AppShell.Header>
        <Group
          h='100%'
          px='lg'
          justify='space-between'
        >
          <Group gap='md'>
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom='sm'
              size='sm'
            />
            <div className='brandMark'>
              <Building2
                size={24}
                color={theme.colors.blue[7]}
              />
            </div>
            <div>
              <Title
                style={{ fontSize: 25 }}
                order={1}
              >
                Solid Batching
              </Title>
            </div>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar
        p='md'
        className='appNavbar'
      >
        <Stack gap='xs'>
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
              className='navItem'
            />
          ))}
          <NavLink
            label='Maintenance'
            active={activeModule.startsWith("maintenance-")}
            leftSection={<Wrench size={18} />}
            defaultOpened
            className='navItem'
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
                className='navItem'
              />
            ))}
          </NavLink>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <div className='page'>
          {activeModule === "sales" && <SalesPage />}
          {activeModule === "payments" && <PaymentsPage />}
          {activeModule === "customers" && <CustomersPage />}
          {activeModule === "graba" && <GrabaPage />}
          {activeModule === "maintenance-designs" && <MaintenanceDesignsPage />}
          {activeModule === "maintenance-sites" && <MaintenanceSitesPage />}
          {activeModule === "maintenance-sales" && (
            <MaintenanceSalesPeoplePage />
          )}
          {activeModule === "maintenance-suppliers" && (
            <MaintenanceSuppliersPage />
          )}
          {activeModule === "expenses" && <ExpensesPurchasingPage />}
        </div>
      </AppShell.Main>
    </AppShell>
  );
}
