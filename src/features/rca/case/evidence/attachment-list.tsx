import { useState } from 'react';
import type { RcaEvidenceAttachment } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { IconButton } from '@/features/ux-kit/icon-button';
import { ActionIcon } from '@/lib/icons';
import { downloadRcaFile } from '../../api/rca-files';

const sizeText = (size: number | null) => (size === null ? '' : size >= 1_048_576 ? `${(size / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} kB`);

export interface AttachmentListProps {
  rcaId: string;
  attachments: readonly RcaEvidenceAttachment[];
  /** edit mode: each file gets a remove button */
  onRemove?: (fileName: string) => void;
}

/** Files of an evidence item: download (authenticated) and, while editing, remove. */
export function AttachmentList({ rcaId, attachments, onRemove }: AttachmentListProps) {
  const [error, setError] = useState<unknown>(null);
  if (attachments.length === 0) return <p className="text-sm text-muted-foreground">No files.</p>;
  const download = (file: RcaEvidenceAttachment) => {
    setError(null);
    downloadRcaFile(rcaId, file.fileName, file.name).catch(setError);
  };
  return (
    <div className="space-y-2">
      <ul className="divide-y rounded border text-sm" data-testid="attachment-list">
        {attachments.map((file) => (
          <li key={file.fileName} className="flex items-center justify-between gap-2 px-2 py-1">
            <span className="truncate">
              {file.name} <span className="text-muted-foreground">{sizeText(file.size)}</span>
            </span>
            <span className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => download(file)}>
                <ActionIcon.export aria-hidden="true" className="mr-1 h-4 w-4" />
                Download
              </Button>
              {onRemove && <IconButton icon={ActionIcon.remove} label={`Remove ${file.name}`} onClick={() => onRemove(file.fileName)} />}
            </span>
          </li>
        ))}
      </ul>
      {error ? <FriendlyErrorAlert error={error} /> : null}
    </div>
  );
}
