import { useState } from 'react';
import { useNotifications, useUnreadNotificationCount } from '@/api/v2/queries/notifications';
import type { NotificationFilter, NotificationView } from '@/api/v2/types/notifications';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { toDigits, useCalendarPreference } from '@/lib/dates';
import { UiIcon } from '@/lib/icons';
import { NotificationList } from './notification-list';
import { useNotificationMarks } from './use-notification-marks';

const FILTERS: ReadonlyArray<[NotificationFilter, string]> = [
  ['all', 'All'],
  ['unread', 'Unread'],
];

function FilterButtons({ filter, onChange, unreadLabel }: { filter: NotificationFilter; onChange: (f: NotificationFilter) => void; unreadLabel: string }) {
  return (
    <div role="group" aria-label="Show notifications" className="mb-2 flex gap-1 px-1">
      {FILTERS.map(([value, label]) => (
        <Button key={value} size="sm" variant={filter === value ? 'secondary' : 'ghost'} aria-pressed={filter === value} onClick={() => onChange(value)}>
          {value === 'unread' ? `${label}${unreadLabel}` : label}
        </Button>
      ))}
    </div>
  );
}

/**
 * The header's in-app notifications (SLA reminders and escalations, work reminders): unread badge, the newest
 * active list (loaded when opened) filtered All / Unread, open-and-mark-read, per-item mark as read / unread and
 * mark all read. Shared work someone already did is resolved on the server and leaves the list. Realtime hints
 * refresh both; nothing is sent by e-mail or SMS.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const pref = useCalendarPreference();
  const { timezone } = usePlantTimezone();
  const unread = useUnreadNotificationCount().data?.unread ?? 0;
  const list = useNotifications(open, filter);
  const marks = useNotificationMarks();
  const openItem = (n: NotificationView) => {
    if (!n.read) marks.read(n.id);
    setOpen(false);
  };
  const count = toDigits(unread > 99 ? '99+' : String(unread), pref.digits);
  const label = unread > 0 ? `Notifications, ${toDigits(String(unread), pref.digits)} unread` : 'Notifications';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} className="relative" data-testid="notification-bell">
          <UiIcon.notifications aria-hidden="true" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 rounded-full bg-destructive px-1 text-xs font-semibold leading-4 text-destructive-foreground" data-testid="notification-unread">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <div className="flex items-center justify-between px-1 pb-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={marks.all} data-testid="notification-read-all">
              Mark all read
            </Button>
          )}
        </div>
        <FilterButtons filter={filter} onChange={setFilter} unreadLabel={unread > 0 ? ` (${count})` : ''} />
        <NotificationList list={list} filter={filter} timezone={timezone} marks={marks} onOpen={openItem} />
      </PopoverContent>
    </Popover>
  );
}
