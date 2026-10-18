import { useApprovalRecord } from './use-approval-record';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';

const HIDDEN = new Set(['id', 'tenantId', 'rowVersion', 'authorId', 'createdBy', 'approvedBy', 'decidedBy', 'updatedAt']);
const words = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
const isInstant = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value);
function RecordValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const { timezone } = usePlantTimezone();
  if (value === null || value === undefined) return <span>—</span>;
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  if (isInstant(value)) return <PlantTime iso={value} tz={timezone} withDate />;
  if (typeof value !== 'object') return <span className="whitespace-pre-wrap break-words">{String(value)}</span>;
  if (depth > 5) return <span>Open the full workspace for this nested detail.</span>;
  if (Array.isArray(value)) return <ol className="space-y-2">{value.map((entry: unknown, index) => <li key={index} className="border-l pl-2"><RecordValue value={entry} depth={depth + 1} /></li>)}</ol>;
  return <dl className="space-y-2">{Object.entries(value).filter(([key]) => !HIDDEN.has(key)).map(([key, entry]) => <div key={key} className="grid grid-cols-[minmax(7rem,1fr)_2fr] gap-3"><dt className="font-medium capitalize">{words(key)}</dt><dd className="min-w-0"><RecordValue value={entry} depth={depth + 1} /></dd></div>)}</dl>;
}
export function ApprovalRecordDetails({ record }: { record: ReturnType<typeof useApprovalRecord> }) {
  if (!record.supported) return null;
  if (record.isLoading) return <p role="status" className="text-sm">Loading the current record…</p>;
  if (record.isError) return <FriendlyErrorAlert error={record.error} onRetry={() => void record.refetch()} />;
  return <details open className="text-xs"><summary className="mb-3 cursor-pointer font-medium">Current record details</summary><div className="max-h-64 overflow-auto rounded-md border p-3"><RecordValue value={record.data} /></div></details>;
}
