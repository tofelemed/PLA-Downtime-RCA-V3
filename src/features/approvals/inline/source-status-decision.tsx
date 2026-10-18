import { useStatusMappings } from '@/api/v2/queries/status-mappings';
import { MappingVersionCard } from '@/features/integration-console/status-mappings/mapping-version-card';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import type { InlineFormProps } from './inline-form-props';
import { useDecidedWhen } from './use-decided-when';

/** A draft of source status rules on the approval page: the version card with its approve control (source owners). */
export function SourceStatusDecision({ item, onDecided }: InlineFormProps) {
  const { timezone } = usePlantTimezone();
  const query = useStatusMappings();
  const version = query.data?.items.find((candidate) => candidate.id === item.id);
  useDecidedWhen(version ? version.state === 'draft' : undefined, 'Status rules approved', onDecided);
  return (
    <DataState state={dataStateOf(query)} error={query.error} onRetry={() => void query.refetch()}>
      {version && <div data-testid="inline-source-status"><MappingVersionCard version={version} timezone={timezone} /></div>}
    </DataState>
  );
}
