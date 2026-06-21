import { SpreadsheetEditor } from '../components/SpreadsheetEditor';
import { modules } from '../data/moduleConfig';

const config = modules.find((module) => module.key === 'maintenance')!;

export function MaintenancePage() {
  return <SpreadsheetEditor config={config} />;
}
