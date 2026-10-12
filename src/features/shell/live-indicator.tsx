import { useRealtimeStatus, type RealtimeStatus } from '@/realtime/realtime-status';
import { cn } from '@/lib/utils';

const DISPLAY: Record<Exclude<RealtimeStatus, 'idle'>, { label: string; title: string; dot: string }> = {
  connecting: { label: 'Connecting…', title: 'Connecting to live updates', dot: 'bg-amber-400' },
  live: { label: 'Live', title: 'Screens update as changes arrive', dot: 'bg-emerald-500' },
  offline: { label: 'Offline', title: 'Live updates are interrupted; reconnecting. Figures may be out of date.', dot: 'bg-red-500' },
};

/** The real state of the live-update channel (replaces the static "System Online" footer). */
export function LiveIndicator({ className }: { className?: string }) {
  const status = useRealtimeStatus();
  if (status === 'idle') return null;
  const display = DISPLAY[status];
  return (
    <span role="status" title={display.title} className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
      <span className={cn('h-2 w-2 rounded-full', display.dot)} aria-hidden />
      {display.label}
    </span>
  );
}
