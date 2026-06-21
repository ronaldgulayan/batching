import { useState } from 'react';
import {
  AppShell,
  Badge,
  Burger,
  Button,
  Group,
  NavLink,
  Stack,
  Text,
  Title,
  useMantineTheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Building2, FileText } from 'lucide-react';
import { CustomersPage } from './pages/CustomersPage';
import { CustomerPricesPage } from './pages/CustomerPricesPage';
import { DispatchPage } from './pages/DispatchPage';
import { ExpensesPurchasingPage } from './pages/ExpensesPurchasingPage';
import { FuelInventoryPage } from './pages/FuelInventoryPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { MasterDataPage } from './pages/MasterDataPage';
import { SalesPage } from './pages/SalesPage';
import { navItems } from './data/moduleConfig';
import type { ModuleKey } from './types';

export function App() {
  const [opened, { toggle, close }] = useDisclosure();
  const [activeModule, setActiveModule] = useState<ModuleKey>('customers');
  const theme = useMantineTheme();

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{
        width: 292,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="lg"
    >
      <AppShell.Header>
        <Group h="100%" px="lg" justify="space-between">
          <Group gap="md">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <div className="brandMark">
              <Building2 size={24} color={theme.colors.blue[7]} />
            </div>
            <div>
              <Title order={1}>Ready-Mix ERP</Title>
              <Text size="xs" c="dimmed">
                Concrete, trucking, dispatch, fuel, maintenance, and purchasing
              </Text>
            </div>
          </Group>
          <Button
            component="a"
            href="/master_sql.sql"
            target="_blank"
            variant="light"
            leftSection={<FileText size={16} />}
          >
            SQL
          </Button>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Stack gap="xs">
          <Badge variant="light" w="fit-content">
            Modules
          </Badge>
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
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <div className="page">
          {activeModule === 'customers' && <CustomersPage />}
          {activeModule === 'sales' && <SalesPage />}
          {activeModule === 'pricing' && <CustomerPricesPage />}
          {activeModule === 'dispatch' && <DispatchPage />}
          {activeModule === 'fuel' && <FuelInventoryPage />}
          {activeModule === 'maintenance' && <MaintenancePage />}
          {activeModule === 'expenses' && <ExpensesPurchasingPage />}
          {activeModule === 'masters' && <MasterDataPage />}
        </div>
      </AppShell.Main>
    </AppShell>
  );
}
