import { useMarkAllNotificationsRead, useMarkNotificationRead, useMarkNotificationUnread } from '@/api/v2/queries/notifications';
import { friendlyToastContent } from '@/features/ux-kit/errors/friendly-toast';
import { useToast } from '@/hooks/use-toast';

export interface NotificationMarks {
  read: (id: string) => void;
  unread: (id: string) => void;
  all: () => void;
}

/** Read / unread marks of the signed-in user; a failure is said in a toast (the badge would otherwise silently stay). */
export function useNotificationMarks(): NotificationMarks {
  const { toast } = useToast();
  const markRead = useMarkNotificationRead();
  const markUnread = useMarkNotificationUnread();
  const markAll = useMarkAllNotificationsRead();
  const fail = (error: unknown) => toast({ ...friendlyToastContent(error), variant: 'destructive' });
  return {
    read: (id) => void markRead.submit({ id }).catch(fail),
    unread: (id) => void markUnread.submit({ id }).catch(fail),
    all: () => void markAll.submit().catch(fail),
  };
}
