import { useHighlightTarget } from './use-highlight-target';

/** Mounted once in the app shell: every page's anchor ids become deep-link targets with an announcement. */
export function HighlightTarget() {
  const message = useHighlightTarget();
  return (
    <div role="status" aria-live="polite" className="sr-only" data-testid="highlight-announcement">
      {message}
    </div>
  );
}
