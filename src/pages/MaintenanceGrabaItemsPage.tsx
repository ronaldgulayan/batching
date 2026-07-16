import { MaintenanceLookupPage } from "../components/MaintenanceLookupPage";

const columns = [
  { key: "item", label: "Item", width: 180, sortable: true },
  { key: "description", label: "Description", width: 280, sortable: true },
  { key: "price", label: "Price", type: "number", width: 140, sortable: true },
] as const;

export function MaintenanceGrabaItemsPage() {
  return (
    <MaintenanceLookupPage
      table="graba_items"
      orderBy="item"
      uniqueKey="item"
      fields={[
        { key: "item", label: "Item", required: true },
        { key: "description", label: "Description" },
        { key: "price", label: "Price", numeric: true, required: false },
      ]}
      columns={columns}
    />
  );
}
