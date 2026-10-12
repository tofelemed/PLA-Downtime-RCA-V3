import { useCodeList } from '@/api/v2/queries/codes-admin';
import type { CodeDetailView } from '@/api/v2/types/codes-admin';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';

export interface ImpactCodePickerProps {
  selected: readonly string[];
  onChange: (ids: string[]) => void;
}

/**
 * Impact codes whose time cost is an independent cost component (VAL02 `independent_components`): only
 * these may be summed with lost margin. The plant's own active codes, 20 per page (the server refuses
 * other codes: 422).
 */
export function ImpactCodePicker({ selected, onChange }: ImpactCodePickerProps) {
  const codes = useCodeList('impact-codes');
  const toggle = (id: string, on: boolean) => onChange(on ? [...selected, id] : selected.filter((entry) => entry !== id));
  const columns: Array<DataTableColumn<CodeDetailView>> = [
    {
      id: 'pick',
      header: '',
      headerLabel: 'Counted on its own',
      width: '3rem',
      cell: (code) => (
        <Checkbox
          checked={selected.includes(code.id)}
          onCheckedChange={(checked) => toggle(code.id, checked === true)}
          aria-label={`Count ${code.code} ${code.name} as an independent cost component`}
        />
      ),
    },
    { id: 'code', header: 'Code', nowrap: true, cell: (code) => <span className="font-mono">{code.code}</span> },
    { id: 'name', header: 'Name', cell: (code) => code.name },
  ];
  return (
    <fieldset className="space-y-2" data-testid="impact-code-picker">
      <legend className="text-sm font-medium">Independent cost components ({selected.length} chosen)</legend>
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
