import { Badge } from '@/components/ui/badge';
import type { RcaCauseView } from '@/features/master-data/api/master-data-types';
import { RCA_CAUSES } from '@/features/master-data/api/record-resource';
import { useRecordDetail } from '@/features/master-data/api/use-record-queries';
import { IconButton } from '@/features/ux-kit/icon-button';
import { ActionIcon } from '@/lib/icons';

/** The words of the cause filter: the catalogue entry once read, else a placeholder (never the raw id). */
function causeText(cause: RcaCauseView | undefined, failed: boolean): string {
  if (cause) return `${cause.code} — ${cause.name}${cause.isActive ? '' : ' (retired)'}`;
  return failed ? 'a cause code of the library' : 'Loading…';
}

/**
 * Item 1.1: the cause-code filter of the case list (drill from the recurring-cause ranking) as a removable
 * chip "Cause: CODE — Name". The server filters the cases; this only names the code.
 */
export function CauseCodeFilterChip({ causeCodeId, onRemove }: { causeCodeId: string; onRemove: () => void }) {
  const cause = useRecordDetail<RcaCauseView>(RCA_CAUSES, causeCodeId);
  const text = `Cause: ${causeText(cause.data, cause.isError)}`;
  return (
    <Badge variant="secondary" className="w-fit gap-1 pr-0" data-testid="case-cause-filter">
      {text}
      <IconButton label={`Remove the filter ${text}`} icon={ActionIcon.remove} className="h-5 w-5" onClick={onRemove} />
    </Badge>
  );
}
