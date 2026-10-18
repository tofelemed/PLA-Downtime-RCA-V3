import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusIcon } from '@/lib/icons';

export interface ToolConflictProps {
  /** someone else saved after this editor was opened; the editor still shows the user's version */
  conflict: boolean;
  /** the user's unsaved words, kept on screen after "Reload latest" */
  keptText: string | null;
  reloading: boolean;
  onReload: () => void;
  onDismissKept: () => void;
}

/**
 * F-6: a concurrent save. "Reload latest" opens the newest saved record; the user's own text stays below
 * in a read-only box to copy back, so nothing typed is lost silently.
 */
export function ToolConflict({ conflict, keptText, reloading, onReload, onDismissKept }: ToolConflictProps) {
  return (
    <>
      {conflict && (
        <Alert data-testid="tool-conflict">
          <StatusIcon.warning aria-hidden="true" className="h-4 w-4" />
          <AlertTitle>Someone else saved this analysis</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>Your changes were not saved. Reload the latest version; your text stays on screen to copy back.</p>
            <Button type="button" size="sm" disabled={reloading} onClick={onReload} data-testid="reload-latest">
              {reloading ? 'Reloading…' : 'Reload latest'}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {keptText !== null && (
        <div className="space-y-1 rounded border p-2" data-testid="kept-text">
          <Label htmlFor="tool-kept-text">Your unsaved text (read only, copy what you need)</Label>
          <Textarea id="tool-kept-text" readOnly value={keptText || 'You had not typed any text.'} rows={Math.min(12, Math.max(3, keptText.split('\n').length))} />
          <Button type="button" size="sm" variant="ghost" onClick={onDismissKept}>
            Hide my old text
          </Button>
        </div>
      )}
    </>
  );
}
