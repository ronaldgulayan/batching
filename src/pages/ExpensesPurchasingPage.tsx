import { SpreadsheetEditor } from '../components/SpreadsheetEditor';
import { modules } from '../data/moduleConfig';

const config = modules.find((module) => module.key === 'expenses')!;

export function ExpensesPurchasingPage() {
  return <SpreadsheetEditor config={config} />;
}
