import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ActionIcon } from '@/lib/icons';

/** Copies a plain-text report of the analysis to the clipboard. */
export function CopyReportButton({ text, disabled }: { text: () => string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard?.writeText(text());
    setCopied(true);
  };
  return (
    <span className="inline-flex items-center gap-2">
      <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => void copy()}>
        <ActionIcon.copy aria-hidden="true" className="mr-1 h-4 w-4" />
        Copy report
      </Button>
      {copied && (
        <span role="status" className="text-sm text-muted-foreground">
          Copied.
        </span>
      )}
    </span>
  );
}
