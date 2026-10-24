import { Label } from '@/components/ui/label';
import { FIELD_CLASS, SELECT_CLASS } from '../components/filter-classes';
import { REPORT_TYPES, firstViewOf, reportsOfType, typeOfView } from './report-catalog';

export interface ReportViewPickerProps {
  /** the shown report (`?view=`) */
  view: string;
  onViewChange: (view: string) => void;
}

/** Report type, then the report of that type; choosing a type opens its first report. */
export function ReportViewPicker({ view, onViewChange }: ReportViewPickerProps) {
  const type = typeOfView(view);
  return (
    <>
      <div className={FIELD_CLASS}>
        <Label htmlFor="report-type">Report type</Label>
        <select id="report-type" data-testid="report-type" className={SELECT_CLASS} value={type.key} onChange={(e) => onViewChange(firstViewOf(e.target.value))}>
          {REPORT_TYPES.map((entry) => (
            <option key={entry.key} value={entry.key}>
              {entry.label}
            </option>
          ))}
        </select>
      </div>
      <div className={FIELD_CLASS}>
        <Label htmlFor="report-view">Report</Label>
        <select id="report-view" data-testid="report-view" className={SELECT_CLASS} value={view} onChange={(e) => onViewChange(e.target.value)}>
          {reportsOfType(type).map((entry) => (
            <option key={entry.key} value={entry.key}>
              {entry.label}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
