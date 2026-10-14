import { IconButton } from '@/features/ux-kit/icon-button';
import { ActionIcon } from '@/lib/icons';

const SHOWN = 24;

/**
 * A source identifier that integration admins work with (a PI WebId, an element path, a topic): shown
 * shortened, in full on hover, with a copy button. Never used for Traverse Forge's own record ids.
 */
export function SourceRef({ value }: { value: string }) {
  const short = value.length > SHOWN ? `${value.slice(0, SHOWN)}…` : value;
  return (
    <span className="inline-flex max-w-full items-center gap-1">
      <code className="truncate text-xs" title={value}>
        {short}
      </code>
      <IconButton label="Copy source identifier" icon={ActionIcon.copy} className="h-6 w-6" onClick={() => void navigator.clipboard?.writeText(value)} />
    </span>
  );
}
