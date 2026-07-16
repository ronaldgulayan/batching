import { MaintenanceLookupPage } from "../components/MaintenanceLookupPage";

const columns = [
  { key: "truck", label: "Truck", width: 180, sortable: true },
  { key: "description", label: "Description", width: 280, sortable: true },
] as const;

export function MaintenanceGrabaTrucksPage() {
  return (
    <MaintenanceLookupPage
      table="graba_trucks"
      orderBy="truck"
      uniqueKey="truck"
      fields={[
        { key: "truck", label: "Truck", required: true },
        { key: "description", label: "Description" },
      ]}
      columns={columns}
    />
  );
}
