import { Link } from 'react-router-dom';
import type { NotificationView } from '@/api/v2/types/notifications';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { useCalendarPreference } from '@/lib/dates';
import { notificationText } from './notification-text';
import type { NotificationMarks } from './use-notification-marks';

interface Props {
  n: NotificationView;
  timezone: string;
  marks: NotificationMarks;
  onOpen: (n: NotificationView) => void;
}

/** One notification: the text links to its record, an "Unread" label (text, not colour only) and a read / unread toggle. */
export function NotificationItem({ n, timezone, marks, onOpen }: Props) {
  const pref = useCalendarPreference();
  const text = notificationText(n, pref);
  const content = (
    <>
      <span className="flex items-start gap-2">
        <span className="font-medium">{text.title}</span>
        {!n.read && (
          <Badge variant="default" className="shrink-0 px-1.5 py-0 text-xs" data-testid="notification-unread-label">
            Unread
          </Badge>
        )}
      </span>
      <span className="block text-muted-foreground">{text.body}</span>
      <PlantTime iso={n.createdAt} tz={timezone} withDate className="block text-xs text-muted-foreground" />
    </>
  );
  return (
    <li className={`rounded-md p-2 text-sm ${n.read ? '' : 'border-l-4 border-primary bg-muted'}`} data-testid="notification" data-read={n.read}>
      {text.href ? (
        <Link to={text.href} className="block hover:underline" onClick={() => onOpen(n)}>
          {content}
        </Link>
      ) : (
        <button type="button" className="block w-full text-left" onClick={() => onOpen(n)}>
          {content}
        </button>
      )}
      <Button
        variant="link"
        size="sm"
        className="h-auto p-0 text-xs"
        aria-label={`${n.read ? 'Mark as unread' : 'Mark as read'}: ${text.title}`}
        onClick={() => (n.read ? marks.unread(n.id) : marks.read(n.id))}
      >
        {n.read ? 'Mark as unread' : 'Mark as read'}
      </Button>
    </li>
  );
}
