import { Link } from 'react-router-dom';
import { useRepairEvidence } from '@/api/v2/queries/reliability-work-orders';
import type { RepairEvidenceView } from '@/api/v2/types/reliability';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { useReliabilityFormat, type ReliabilityFormat } from '../shared/use-reliability-format';
import { WorkOrderTable } from './work-order-table';

function EvidenceFacts({ evidence, format }: { evidence: RepairEvidenceView; format: ReliabilityFormat }) {
  if (evidence.reason === 'no_operations') {
    return <p className="text-sm text-muted-foreground">No diagnosis, repair or test operation from the CMMS is linked to this stop, so it gives no active repair time; its restore time is the stop itself.</p>;
  }
  if (evidence.reason === 'operation_open') {
    return <p className="text-sm text-muted-foreground">{format.number(evidence.openOperations)} operation(s) still running: the active repair time is known once they end.</p>;
  }
  return (
    <dl className="grid grid-cols-[12rem_1fr] gap-x-3 gap-y-1 text-sm" data-testid="repair-evidence">
      <dt className="text-muted-foreground">Active repair</dt>
      <dd>{format.duration(evidence.activeRepairSeconds ?? 0)}</dd>
      <dt className="text-muted-foreground">Waiting (parts, permit, crew)</dt>
      <dd>{format.duration(evidence.waitingSeconds)}</dd>
      <dt className="text-muted-foreground">Repair work</dt>
      <dd>{format.dateTime(evidence.repairStart)} – {format.dateTime(evidence.repairEnd)}</dd>
      <dt className="text-muted-foreground">Operations</dt>
      <dd>{format.number(evidence.activeOperations)} active of {format.number(evidence.operations)}</dd>
    </dl>
  );
}

/**
 * The stop's repair evidence (SME D10) as the server counts it for "Mean active repair time": diagnosis,
 * repair and test operations, overlaps once, minus waiting — and the operations behind it.
 */
export function RepairEvidencePanel({ eventId }: { eventId: string }) {
  const format = useReliabilityFormat();
  const evidence = useRepairEvidence(eventId);
  const { canManageMasterData, canWriteWorkOrders } = useCapabilities();
  return (
    <div className="space-y-3" data-testid="repair-panel">
      <DataState state={dataStateOf(evidence)} error={evidence.error} onRetry={() => void evidence.refetch()}>
        {evidence.data && <EvidenceFacts evidence={evidence.data} format={format} />}
      </DataState>
      <WorkOrderTable filters={{ eventId }} format={format} />
      {(canManageMasterData || canWriteWorkOrders) && <Link className="text-sm underline" to={`/master-data/work-orders?eventId=${eventId}`}>Open in work-order operations</Link>}
    </div>
  );
}
