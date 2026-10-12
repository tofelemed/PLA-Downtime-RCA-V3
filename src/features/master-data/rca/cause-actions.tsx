import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { IconButton } from '@/features/ux-kit/icon-button';
import { ActionIcon } from '@/lib/icons';
import type { RcaCauseView } from '../api/master-data-types';

export type CauseAction = 'addChild' | 'edit' | 'move' | 'retire' | 'restore';

/** Row actions of a cause: add sub-cause and edit as buttons, move / retire / restore in a menu. */
export function CauseActions({ cause, onAction }: { cause: RcaCauseView; onAction: (cause: RcaCauseView, action: CauseAction) => void }) {
  if (!cause.isActive) {
    return <IconButton icon={ActionIcon.reset} label={`Restore ${cause.name}`} onClick={() => onAction(cause, 'restore')} />;
  }
  return (
    <span className="flex items-center">
      <IconButton icon={ActionIcon.add} label={`Add a sub-cause to ${cause.name}`} onClick={() => onAction(cause, 'addChild')} />
      <IconButton icon={ActionIcon.edit} label={`Edit ${cause.name}`} onClick={() => onAction(cause, 'edit')} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton icon={ActionIcon.more} label={`More actions for ${cause.name}`} tooltip={false} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onAction(cause, 'move')}>Move under…</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onSelect={() => onAction(cause, 'retire')}>
            Retire…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
