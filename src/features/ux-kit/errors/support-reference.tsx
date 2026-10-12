import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ActionIcon } from '@/lib/icons';
import type { SupportReferenceInfo } from './describe-error';
import { supportReferenceText } from './support-reference-text';

export interface SupportReferenceProps {
  reference: SupportReferenceInfo | null | undefined;
  className?: string;
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

type CopyState = { kind: 'idle' } | { kind: 'copied' } | { kind: 'manual'; text: string };

/**
 * "Copy support reference" (docs/UI_UX_AUDIT.md §6): copies code, status and correlation id for support
 * without showing them. Without clipboard access it shows the line in a selected read-only field.
 * Renders nothing when the reference has neither a code nor a correlation id.
 */
export function SupportReference({ reference, className }: SupportReferenceProps) {
  const [state, setState] = useState<CopyState>({ kind: 'idle' });
  if (!reference || (!reference.code && !reference.correlationId)) return null;
  const copy = async () => {
    const text = supportReferenceText(reference);
    setState((await writeClipboard(text)) ? { kind: 'copied' } : { kind: 'manual', text });
  };
  const Icon = ActionIcon.copy;
  return (
    <div className={className}>
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={copy}>
        <Icon className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
        Copy support reference
      </Button>
      <span aria-live="polite" className="ml-2 text-xs text-muted-foreground">
        {state.kind === 'copied' ? 'Copied' : ''}
      </span>
      {state.kind === 'manual' && (
        <Input
          readOnly
          autoFocus
          aria-label="Support reference (copy it manually)"
          className="mt-1 h-7 text-xs"
          value={state.text}
          onFocus={(event) => event.currentTarget.select()}
        />
      )}
    </div>
  );
}
