import { MaintenanceLookupPage } from '../components/MaintenanceLookupPage';
const columns = [
  { key: 'name', label: 'Site', width: 220, sortable: true },
  { key: 'address', label: 'Address', width: 280, sortable: true },
  { key: 'remarks', label: 'Remarks', width: 260 },
] as const;

export function MaintenanceSitesPage() {
  return (
    <MaintenanceLookupPage
      table="project_sites"
      orderBy="name"
      uniqueKey="name"
      fields={[
        { key: 'name', label: 'Site', required: true },
        { key: 'address', label: 'Address' },
        { key: 'remarks', label: 'Remarks' },
      ]}
      columns={columns}
    />
  );
}
