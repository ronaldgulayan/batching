import { MaintenanceLookupPage } from '../components/MaintenanceLookupPage';
const columns = [
  { key: 'code', label: 'Design', width: 160, sortable: true },
  { key: 'description', label: 'Description', width: 260, sortable: true },
] as const;

export function MaintenanceDesignsPage() {
  return (
    <MaintenanceLookupPage
      table="concrete_designs"
      orderBy="code"
      uniqueKey="code"
      fields={[
        { key: 'code', label: 'Design', required: true },
        { key: 'description', label: 'Description' },
      ]}
      columns={columns}
    />
  );
}
