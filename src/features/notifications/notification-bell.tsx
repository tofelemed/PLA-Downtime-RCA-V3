import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications, useUnreadNotificationCount } from '@/api/v2/queries/notifications';
import type { NotificationView } from '@/api/v2/types/notifications';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { toDigits, useCalendarPreference } from '@/lib/dates';
import { UiIcon } from '@/lib/icons';
import { notificationText } from './notification-text';

function Item({ n, timezone, onOpen }: { n: NotificationView; timezone: string; onOpen: (n: NotificationView) => void }) {
  const pref = useCalendarPreference();
  const text = notificationText(n, pref);
  const content = (
    <>
      <span className="block font-medium">{text.title}</span>
      <span className="block text-muted-foreground">{text.body}</span>
      <PlantTime iso={n.createdAt} tz={timezone} withDate className="block text-xs text-muted-foreground" />
    </>
  );
  return (
    <li className={`rounded-md p-2 text-sm ${n.read ? '' : 'bg-muted'}`} data-testid="notification" data-read={n.read}>
      {text.href ? (
        <Link to={text.href} className="block hover:underline" onClick={() => onOpen(n)}>
          {content}
        </Link>
      ) : (
        <button type="button" className="block w-full text-left" onClick={() => onOpen(n)}>
          {content}
        </button>
      )}
    </li>
  );
}

/**
 * The header's in-app notifications (EXPERT_REVIEW Area 3: SLA escalations): unread badge, the newest list
 * (loaded when opened), open-and-mark-read and mark all read. Realtime hints refresh both; nothing is sent by
 * e-mail or SMS.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const pref = useCalendarPreference();
  const { timezone } = usePlantTimezone();
  const unread = useUnreadNotificationCount().data?.unread ?? 0;
  const list = useNotifications(open);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const items = list.data?.items ?? [];
  const openItem = (n: NotificationView) => {
    if (!n.read) void markRead.submit({ id: n.id }).catch(() => undefined);
    setOpen(false);
  };
  const label = unread > 0 ? `Notifications, ${toDigits(String(unread), pref.digits)} unread` : 'Notifications';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} className="relative" data-testid="notification-bell">
          <UiIcon.notifications aria-hidden="true" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-destructive-foreground" data-testid="notification-unread">
              {toDigits(unread > 99 ? '99+' : String(unread), pref.digits)}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <div className="flex items-center justify-between px-1 pb-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={() => void markAll.submit().catch(() => undefined)} data-testid="notification-read-all">
              Mark all read
            </Button>
          )}
        </div>
        {list.isLoading && <p className="px-1 text-sm text-muted-foreground">Loading…</p>}
        {!list.isLoading && items.length === 0 && <p className="px-1 text-sm text-muted-foreground">No notifications.</p>}
        <ul className="max-h-96 space-y-1 overflow-y-auto" data-testid="notification-list">
          {items.map((n) => (
            <Item key={n.id} n={n} timezone={timezone} onOpen={openItem} />
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
