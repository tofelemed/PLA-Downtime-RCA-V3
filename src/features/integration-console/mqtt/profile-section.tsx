import { useEffect, useId, useState, type ReactNode } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { UiIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';

interface ProfileSectionProps {
  name: string;
  title: string;
  summary: string;
  errors: Array<string | undefined>;
  failure: unknown;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** Disclosure only: children stay mounted and the parent keeps the single profile draft. */
export function ProfileSection({ name, title, summary, errors, failure, defaultOpen = false, children }: ProfileSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const headingId = useId();
  const { number } = useNumberFormat();
  const messages = errors.filter(Boolean);
  const errorKey = messages.join('\n');
  useEffect(() => { if (errorKey) setOpen(true); }, [errorKey, failure]);
  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <section aria-labelledby={headingId} className="min-w-0 scroll-mt-40 rounded-lg border bg-background" data-testid={`profile-section-${name}`}>
        <h3 id={headingId}>
          <CollapsibleTrigger className="flex w-full min-w-0 items-start gap-3 rounded-lg px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <UiIcon.expand aria-hidden="true" className={cn('mt-0.5 h-4 w-4 shrink-0 transition-transform', !open && '-rotate-90')} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{title}</span>
              <span className="mt-1 block break-words text-xs font-normal text-muted-foreground">{summary}</span>
              {messages.length > 0 && <span className="mt-1 block text-xs font-medium text-destructive">{number(messages.length)} {messages.length === 1 ? 'field needs' : 'fields need'} attention</span>}
            </span>
          </CollapsibleTrigger>
        </h3>
        <CollapsibleContent forceMount hidden={!open} className="space-y-4 px-4 pb-4">{children}</CollapsibleContent>
      </section>
    </Collapsible>
  );
}
