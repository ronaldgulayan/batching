import { SpreadsheetEditor } from '../components/SpreadsheetEditor';
import { modules } from '../data/moduleConfig';

const config = modules.find((module) => module.key === 'fuel')!;

export function FuelInventoryPage() {
  return <SpreadsheetEditor config={config} />;
}
