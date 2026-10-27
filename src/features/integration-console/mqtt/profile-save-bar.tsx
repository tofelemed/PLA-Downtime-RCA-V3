import { Button } from '@/components/ui/button';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import type { ProfileEditor } from './hooks/use-profile-draft';

/** What the save bar needs of a profile editor (contract v1 draft or feeds draft). */
export type SaveBarEditor = Pick<ProfileEditor, 'patch' | 'savedAt' | 'failed' | 'isPending' | 'save' | 'reset'> & { errors: Readonly<Record<string, unknown>> };

interface SaveBarProps {
  editor: SaveBarEditor;
  canWrite: boolean;
}

export function ProfileSaveBar({ editor, canWrite }: SaveBarProps) {
  const { number } = useNumberFormat();
  const dirty = editor.patch !== null;
  const errorCount = Object.keys(editor.errors).length;
  const saved = Boolean(editor.savedAt && !dirty && !editor.failed && !editor.isPending);
  const status = saveStatus(editor, errorCount, number);
  return (
    <div className="sticky top-14 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3 shadow-sm" data-testid="profile-save-bar">
      <p role="status" className="min-w-0 text-sm text-muted-foreground" data-testid={saved ? 'profile-saved' : 'profile-save-status'}>{status}</p>
      <div className="flex flex-wrap items-center gap-2">
        {canWrite && <Button size="sm" onClick={() => void editor.save()} disabled={!dirty || errorCount > 0 || editor.isPending} data-testid="profile-save">{editor.isPending ? 'Saving…' : 'Save profile'}</Button>}
        <Button size="sm" variant="outline" onClick={editor.reset} disabled={!dirty} data-testid="profile-reset">Discard changes</Button>
      </div>
    </div>
  );
}

function saveStatus(editor: SaveBarEditor, errorCount: number, format: (value: number) => string): string {
  if (editor.isPending) return 'Saving profile…';
  if (errorCount > 0) return `${format(errorCount)} ${errorCount === 1 ? 'field needs' : 'fields need'} attention before saving`;
  if (editor.failed) return 'Profile was not saved. Review the error below.';
  if (editor.patch !== null) return 'Unsaved changes';
  return editor.savedAt ? 'Profile saved.' : 'No unsaved changes';
}
