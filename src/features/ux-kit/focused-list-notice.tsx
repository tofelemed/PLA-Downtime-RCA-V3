import { Button } from '@/components/ui/button';
import type { AnchorFocus } from './use-anchor-focus';

/**
 * Under a list opened at a deep-linked row (`useAnchorFocus`): says that earlier rows are not shown and offers
 * the list from its start. Renders nothing for an ordinary list.
 */
export function FocusedListNotice({ anchor, what }: { anchor: AnchorFocus; what: string }) {
  if (!anchor.focus) return null;
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground" data-testid="focused-list-notice">
      Showing {what} from the one in your link; earlier ones are not listed.
      <Button size="sm" variant="link" className="h-auto p-0" onClick={anchor.showFromStart}>
        Show all from the start
      </Button>
    </p>
  );
}
