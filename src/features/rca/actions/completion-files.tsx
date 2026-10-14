import { useId, useState } from 'react';
import type { RcaCompletionAttachment } from '@/api/v2/types/rca-workflow';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { uploadRcaFile } from '../api/rca-files';
import { AttachmentList } from '../case/evidence/attachment-list';

export interface CompletionFilesProps {
  rcaId: string;
  value: RcaCompletionAttachment[];
  /** null = show the files without upload or remove */
  onChange: ((next: RcaCompletionAttachment[]) => void) | null;
}

const listed = (files: readonly RcaCompletionAttachment[]) => files.map((file) => ({ ...file, contentType: null, size: null }));

/** Completion files of an action, uploaded with the case attachment upload and kept when the evidence is saved. */
export function CompletionFiles({ rcaId, value, onChange }: CompletionFilesProps) {
  const inputId = useId();
  const [error, setError] = useState<unknown>(null);
  const [uploading, setUploading] = useState(false);
  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !onChange) return;
    setError(null);
    setUploading(true);
    const added: RcaCompletionAttachment[] = [];
    try {
      for (const file of Array.from(files)) {
        const stored = await uploadRcaFile(rcaId, file);
        added.push({ fileName: stored.fileName, name: stored.name });
      }
    } catch (failure) {
      setError(failure);
    } finally {
      onChange([...value, ...added]);
      setUploading(false);
    }
  };
  const remove = onChange ? (fileName: string) => onChange(value.filter((file) => file.fileName !== fileName)) : undefined;
  return (
    <div className="space-y-1">
      {onChange && (
        <>
          <Label htmlFor={inputId}>Completion files (optional)</Label>
          <Input id={inputId} type="file" multiple disabled={uploading} onChange={(e) => void upload(e.target.files)} />
        </>
      )}
      {uploading && (
        <p role="status" className="text-sm text-muted-foreground">
          Uploading…
        </p>
      )}
      {error ? <FriendlyErrorAlert error={error} /> : null}
      <AttachmentList rcaId={rcaId} attachments={listed(value)} onRemove={remove} />
    </div>
  );
}
