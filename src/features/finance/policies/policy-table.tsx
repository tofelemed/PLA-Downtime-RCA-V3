import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import type { ValuationPolicyView } from '@/api/v2/types/valuation';
import { usePlantDates } from '@/features/codes-admin/hooks/use-plant-dates';
import { DataTable, type DataTableColumn, type DataTableStatus, type PagerModel } from '@/features/ux-kit/data-table';
import { DEFAULT_BASIS_LABELS, labelOf } from '@/features/ux-kit/labels';
import { POLICY_STATUS_LABELS } from '@/features/ux-kit/labels/codes-finance-labels';
import { currenciesLabel, policyStatus } from '../model/policy-status';
import { PolicyPerson } from '../components/policy-person';

export interface PolicyTableProps {
  policies: readonly ValuationPolicyView[];
  pager?: PagerModel;
  status?: DataTableStatus;
}

/** Valuation policy versions newest first, 20 per page; a row opens the version's page (approval there). */
export function PolicyTable({ policies, pager, status }: PolicyTableProps) {
  const navigate = useNavigate();
  const dates = usePlantDates();
  const columns: Array<DataTableColumn<ValuationPolicyView>> = [
    {
      id: 'version',
      header: 'Version',
      nowrap: true,
      cell: (policy) => (
        <span data-testid="policy-row" data-version={policy.version} data-status={policyStatus(policy)}>
          Version {policy.version}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      nowrap: true,
      cell: (policy) => (
        <Badge variant={policy.approved ? 'default' : 'outline'} data-testid="policy-status">
          {POLICY_STATUS_LABELS[policyStatus(policy)]}
        </Badge>
      ),
    },
    { id: 'currencies', header: 'Reporting currencies', cell: currenciesLabel },
    { id: 'basis', header: 'Default basis', cell: (policy) => labelOf(DEFAULT_BASIS_LABELS, typeof policy.body.defaultBasis === 'string' ? policy.body.defaultBasis : null) },
    { id: 'from', header: 'From', nowrap: true, cell: (policy) => dates.effectiveFrom(policy.effectiveFrom) },
    { id: 'author', header: 'Author', cell: (policy) => <PolicyPerson id={policy.createdBy} /> },
  ];
  return (
    <DataTable
      caption="Valuation policy versions"
      columns={columns}
      rows={policies}
      getRowKey={(policy) => policy.id}
      pager={pager}
      status={status}
      empty={{ title: 'No valuation policy versions', text: 'No valuation policy versions yet.' }}
      onRowClick={(policy) => navigate(`/finance/policies/${policy.id}`)}
      rowLabel={(policy) => `Valuation policy version ${policy.version}`}
    />
  );
}
