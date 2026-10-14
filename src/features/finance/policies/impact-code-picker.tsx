import { useCodeList } from '@/api/v2/queries/codes-admin';
import type { CodeDetailView } from '@/api/v2/types/codes-admin';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

export interface ImpactCodePickerProps {
  selected: readonly string[];
  onChange: (ids: string[]) => void;
  /** defaults: the independent-cost-component wording */
  legend?: string;
  checkLabel?: string;
  testId?: string;
}

/**
 * Impact codes whose time cost is an independent cost component (VAL02 `independent_components`): only
 * these may be summed with lost margin. The plant's own active codes, 20 per page (the server refuses
 * other codes: 422).
 */
export function ImpactCodePicker({ selected, onChange, legend = 'Independent cost components', checkLabel = 'Counted on its own', testId = 'impact-code-picker' }: ImpactCodePickerProps) {
  const { number } = useNumberFormat();
  const codes = useCodeList('impact-codes');
  const toggle = (id: string, on: boolean) => onChange(on ? [...selected, id] : selected.filter((entry) => entry !== id));
  const columns: Array<DataTableColumn<CodeDetailView>> = [
    {
      id: 'pick',
      header: '',
      headerLabel: checkLabel,
      width: '3rem',
      cell: (code) => (
        <Checkbox
          checked={selected.includes(code.id)}
          onCheckedChange={(checked) => toggle(code.id, checked === true)}
          aria-label={`${checkLabel}: ${code.code} ${code.name}`}
        />
      ),
    },
    { id: 'code', header: 'Code', nowrap: true, cell: (code) => <span className="font-mono">{code.code}</span> },
    { id: 'name', header: 'Name', cell: (code) => code.name },
  ];
  return (
    <fieldset className="space-y-2" data-testid={testId}>
      <legend className="text-sm font-medium">
        {legend} ({number(selected.length)} chosen)
      </legend>
      <DataTable
        caption="Impact codes"
        columns={columns}
        rows={codes.items.filter((code) => code.active)}
        getRowKey={(code) => code.id}
        status={{ isLoading: codes.isLoading, isError: codes.isError, error: codes.error, onRetry: () => void codes.refetch() }}
        empty={{ title: 'This plant has no impact codes', text: 'Add impact codes in Codes & rules first.' }}
        density="compact"
      />
    </fieldset>
  );
}
