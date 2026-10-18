import type { useNotifications } from '@/api/v2/queries/notifications';
import type { NotificationFilter, NotificationView } from '@/api/v2/types/notifications';
import { InlineError } from '@/features/ux-kit/errors/inline-error';
import { NotificationItem } from './notification-item';
import type { NotificationMarks } from './use-notification-marks';

interface Props {
  list: ReturnType<typeof useNotifications>;
  filter: NotificationFilter;
  timezone: string;
  marks: NotificationMarks;
  onOpen: (n: NotificationView) => void;
}

/** Loading, a failed load (with Retry, never "No notifications."), empty, or the list. */
export function NotificationList({ list, filter, timezone, marks, onOpen }: Props) {
  if (list.isLoading) return <p className="px-1 text-sm text-muted-foreground">Loading…</p>;
  if (list.isError) {
    return <InlineError className="px-1" error={list.error} title="Could not load notifications." onRetry={() => void list.refetch()} />;
  }
  const items = list.data?.items ?? [];
  if (items.length === 0) {
    return <p className="px-1 text-sm text-muted-foreground">{filter === 'unread' ? 'No unread notifications.' : 'No notifications.'}</p>;
  }
  return (
    <ul className="max-h-96 space-y-1 overflow-y-auto" data-testid="notification-list">
      {items.map((n) => (
        <NotificationItem key={n.id} n={n} timezone={timezone} marks={marks} onOpen={onOpen} />
      ))}
    </ul>
  );
}
