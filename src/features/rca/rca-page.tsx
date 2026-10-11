import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { ReadOnlyHint } from '@/features/ux-kit/read-only-hint';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { CaseDetail } from './cases/case-detail';
import { CaseList } from './cases/case-list';
import { CreateCaseDialog } from './cases/create-case-dialog';

/**
 * RCA module on v2 (plan 3.9, `v2.rca`): case search, cases with their nested analysis, links to events /
 * approved loss lines / work orders with evidence packages, actions with verification, and the three
 * separate outcome figures. Recommendations come from the server's trigger service (recommend-only, D13).
 */
export function RcaPage() {
  const tenantId = useV2TenantId();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant (tenant) to see its RCA cases." />;
  return <RcaScreen />;
}

function RcaScreen() {
  const { canWriteRca } = useCapabilities();
  const { timezone, source } = usePlantTimezone();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const selected = params.get('case');
  const select = (id: string) => setParams({ case: id });
  return (
    <div className="space-y-4" data-testid="rca-v2">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Root cause analysis</h1>
          <p className="text-sm text-muted-foreground">
            Cases of this plant. Triggers only recommend (D13); approved loss comes from approved periods. Times in {timezone}
            {source === 'utc-fallback' ? ' (no plant timezone configured)' : ''}.
          </p>
        </div>
        {canWriteRca ? (
          <Button onClick={() => setCreating(true)} data-testid="new-case">New case</Button>
        ) : (
          <ReadOnlyHint />
        )}
      </header>
      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <CaseList selectedId={selected} onSelect={select} />
        {selected ? (
          <CaseDetail key={selected} id={selected} timezone={timezone} />
        ) : (
          <p className="text-sm text-muted-foreground">Select a case, or link one from an event in the Event Hub.</p>
        )}
      </div>
      {creating && (
        <CreateCaseDialog
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            select(id);
          }}
        />
      )}
    </div>
  );
}
