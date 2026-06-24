import { MaintenanceLookupPage } from "../components/MaintenanceLookupPage";

const columns = [
  { key: "name", label: "Supplier", width: 220, sortable: true },
  { key: "contact_person", label: "Contact", width: 180, sortable: true },
  { key: "phone", label: "Phone", width: 160 },
  { key: "address", label: "Address", width: 280 },
] as const;

export function MaintenanceSuppliersPage() {
  return (
    <MaintenanceLookupPage
      table='suppliers'
      orderBy='name'
      uniqueKey='name'
      fields={[
        { key: "name", label: "Supplier", required: true },
        { key: "contact_person", label: "Contact" },
        { key: "phone", label: "Phone" },
        { key: "address", label: "Address" },
      ]}
      columns={columns}
    />
  );
}
