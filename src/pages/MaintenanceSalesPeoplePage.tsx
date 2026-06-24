import { MaintenanceLookupPage } from '../components/MaintenanceLookupPage';
const columns = [
  { key: 'name', label: 'Name', width: 220, sortable: true },
  { key: 'phone', label: 'Phone', width: 160 },
  { key: 'remarks', label: 'Remarks', width: 280 },
] as const;

export function MaintenanceSalesPeoplePage() {
  return (
    <MaintenanceLookupPage
      table="sales_people"
      orderBy="name"
      uniqueKey="name"
      fields={[
        { key: 'name', label: 'Name', required: true },
        { key: 'phone', label: 'Phone' },
        { key: 'remarks', label: 'Remarks' },
      ]}
      columns={columns}
    />
  );
}
