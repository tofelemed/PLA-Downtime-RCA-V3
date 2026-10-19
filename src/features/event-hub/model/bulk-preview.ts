import type { BulkCodePreviewView } from '@/api/v2/types/event-operations';

/**
 * Events whose coding a bulk apply changes (QA audit F5): the server's `changedCount`; an older server that
 * does not send it reports only the eligible count.
 */
export function bulkChanges(preview: BulkCodePreviewView): number {
  return preview.changedCount ?? preview.count;
}
