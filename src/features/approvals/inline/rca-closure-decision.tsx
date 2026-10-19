import { useMemo } from 'react';
import { useRcaCase } from '@/api/v2/queries/rca-cases';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { CaseWorkspaceContext } from '@/features/rca/case/case-context';
import { workspaceOf } from '@/features/rca/case/workspace-of';
import { WorkflowPanel } from '@/features/rca/case/workflow/workflow-panel';
import { normalizeCase } from '@/features/rca/model/normalize-case';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import type { InlineFormProps } from './inline-form-props';
import { useDecidedWhen } from './use-decided-when';

const CLOSURE_REVIEW = 'Closure Review';

/**
 * RCA closure approval on the approval page: the case workflow panel of the workspace (status, closure
 * blockers, the independent-approver rule from the server's readiness, approve / reject the closure).
 */
export function RcaClosureDecision({ item, onDecided }: InlineFormProps) {
  const { canWriteRca } = useCapabilities();
  const query = useRcaCase(item.id);
  const rca = query.data;
  const value = useMemo(() => (rca ? workspaceOf(normalizeCase(rca), canWriteRca) : null), [rca, canWriteRca]);
  const status = value?.rca.status;
  useDecidedWhen(status === undefined ? undefined : status === CLOSURE_REVIEW, status === 'Closed' ? 'Closure approved' : 'Closure returned to the investigation', onDecided);
  return (
    <DataState state={dataStateOf(query)} error={query.error} onRetry={() => void query.refetch()}>
      {value && (
        <CaseWorkspaceContext.Provider value={value}>
          <div data-testid="inline-rca-closure">
            <WorkflowPanel />
          </div>
        </CaseWorkspaceContext.Provider>
      )}
    </DataState>
  );
}
