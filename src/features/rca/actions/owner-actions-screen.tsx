import { useSearchParams } from 'react-router-dom';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import { OWNER_STATUS_LABELS, OWNER_STATUSES, ownerStatusFromParams, type OwnerStatus } from '../model/action-queue-filters';
import { MyRcaActionsList } from './my-rca-actions-list';

function OwnerStatusFilter({ value, onChange }: { value: OwnerStatus; onChange: (next: OwnerStatus) => void }) {
  return (
    <div className="space-y-1">
      <Label htmlFor="owner-action-status">Status</Label>
      <Select value={value} onValueChange={(next) => onChange(OWNER_STATUSES.find((s) => s === next) ?? 'open')}>
        <SelectTrigger id="owner-action-status" className="w-full sm:w-56" data-testid="owner-action-status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OWNER_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {OWNER_STATUS_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * `/rca` for a member without analysis roles (an operator): the RCA actions they own, each linking its
 * investigation (read-only). Owners update progress and evidence on the action (Marun E2E owner rule). The
 * status filter (`?status=open|done|all`, default open) reaches their done actions too (Marun G2); the list
 * is always their own.
 */
export function OwnerActionsScreen() {
  const [params, setParams] = useSearchParams();
  const status = ownerStatusFromParams(params);
  const setStatus = (next: OwnerStatus) => setParams(next === 'open' ? {} : { status: next }, { replace: true });
  return (
    <div data-testid="rca-owner-actions">
      <Page width="wide">
        <PageHeader title="My RCA actions" description="Corrective and preventive actions you own. Open the investigation to record progress and completion evidence; someone else checks the evidence and marks the action done." />
        <Section title="Actions">
          <div className="space-y-3">
            <OwnerStatusFilter value={status} onChange={setStatus} />
            <MyRcaActionsList mine status={status} limit={20} showAllLink={false} />
          </div>
        </Section>
      </Page>
    </div>
  );
}
