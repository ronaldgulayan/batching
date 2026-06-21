import { SpreadsheetEditor } from '../components/SpreadsheetEditor';
import { modules } from '../data/moduleConfig';

const config = modules.find((module) => module.key === 'dispatch')!;

export function DispatchPage() {
  return <SpreadsheetEditor config={config} />;
}
