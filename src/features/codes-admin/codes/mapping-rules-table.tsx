import { useMemo } from 'react';
import { useCodeList, useCodeMappingRules } from '@/api/v2/queries/codes-admin';
import type { CodeMappingRuleView } from '@/api/v2/types/codes-admin';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { CODE_MAPPING_RULE_KIND_LABELS, labelOf } from '@/features/ux-kit/labels';
import { OEE_COMPONENT_LABELS, SCHEDULE_CLASS_LABELS } from '@/features/ux-kit/labels/codes-finance-labels';
import { usePlantDates } from '../hooks/use-plant-dates';

/** The default a mapping version sets, as a label (impact codes by their code). */
function useTargetText() {
  const impacts = useCodeList('impact-codes', { includeRetired: true });
  return (rule: CodeMappingRuleView): string => {
    if (rule.targetCodeId) return impacts.items.find((entry) => entry.id === rule.targetCodeId)?.code ?? 'Another impact code';
    const labels = rule.ruleKind === 'reason_to_oee' ? OEE_COMPONENT_LABELS : SCHEDULE_CLASS_LABELS;
    return labelOf(labels, rule.targetValue);
  };
}

/**
 * Every version of the default mappings of one reason code, grouped by mapping, newest first, 20 per
 * page. Versions are append-only: past events keep the mapping that was in force (T18).
 */
export function MappingRulesTable({ reasonId }: { reasonId: string }) {
  const rules = useCodeMappingRules(reasonId);
  const dates = usePlantDates();
  const targetText = useTargetText();
  const sorted = useMemo(() => [...rules.items].sort((a, b) => a.ruleKind.localeCompare(b.ruleKind) || b.version - a.version), [rules.items]);
  const columns: Array<DataTableColumn<CodeMappingRuleView>> = [
    { id: 'kind', header: 'Mapping', cell: (rule) => labelOf(CODE_MAPPING_RULE_KIND_LABELS, rule.ruleKind) },
    {
      id: 'version',
      header: 'Version',
      nowrap: true,
      cell: (rule) => (
        <span data-testid="mr-row" data-kind={rule.ruleKind} data-version={rule.version} data-target={rule.targetValue ?? rule.targetCodeId ?? ''}>
          Version {rule.version}
        </span>
      ),
    },
    { id: 'target', header: 'Default', cell: targetText },
    { id: 'valid', header: 'Valid', nowrap: true, cell: (rule) => dates.validity(rule.effectiveFrom, rule.effectiveTo) },
  ];
  return (
    <DataTable
      caption="Default mapping history"
      columns={columns}
      rows={sorted}
      getRowKey={(rule) => rule.id}
      status={{ isLoading: rules.isLoading, isError: rules.isError, error: rules.error, onRetry: () => void rules.refetch() }}
      empty={{ title: 'No default mappings yet', text: "The code's own defaults apply." }}
    />
  );
}
