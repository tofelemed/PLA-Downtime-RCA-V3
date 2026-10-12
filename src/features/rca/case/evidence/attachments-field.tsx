import { useId, useState } from 'react';
import type { RcaEvidenceAttachment } from '@/api/v2/types/rca';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { Section } from '@/features/ux-kit/page-layout';
import { uploadRcaFile } from '../../api/rca-files';
import { AttachmentList } from './attachment-list';

export interface AttachmentsFieldProps {
  rcaId: string;
  value: RcaEvidenceAttachment[];
  onChange: (next: RcaEvidenceAttachment[]) => void;
  onBusy: (busy: boolean) => void;
}

/**
 * Files of the evidence item: each file is uploaded at once (25 MB, documents, images, videos) and kept
 * with the item when the evidence is saved.
 */
export function AttachmentsField({ rcaId, value, onChange, onBusy }: AttachmentsFieldProps) {
  const inputId = useId();
  const [error, setError] = useState<unknown>(null);
  const [uploading, setUploading] = useState(false);
  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    onBusy(true);
    const added: RcaEvidenceAttachment[] = [];
    try {
      for (const file of Array.from(files)) added.push(await uploadRcaFile(rcaId, file));
    } catch (failure) {
      setError(failure);
    } finally {
      onChange([...value, ...added]);
      setUploading(false);
      onBusy(false);
    }
  };
  return (
    <Section title="Files" headingLevel={3} description="Photos, documents, spreadsheets or videos (up to 25 MB each).">
      <div className="space-y-2">
        <Label htmlFor={inputId}>Add files</Label>
        <Input id={inputId} type="file" multiple disabled={uploading} onChange={(e) => void upload(e.target.files)} />
        {uploading && (
          <p role="status" className="text-sm text-muted-foreground">
            Uploading…
          </p>
        )}
        {error ? <FriendlyErrorAlert error={error} /> : null}
        <AttachmentList rcaId={rcaId} attachments={value} onRemove={(fileName) => onChange(value.filter((file) => file.fileName !== fileName))} />
      </div>
    </Section>
  );
}
