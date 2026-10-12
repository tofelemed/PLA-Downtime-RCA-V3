import { useId, useState, type ReactNode } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { UiIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';

export interface SectionProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  id?: string;
  /** default 2 (directly under the page's h1) */
  headingLevel?: 2 | 3;
  /** the title becomes a disclosure button (`aria-expanded`) */
  collapsible?: boolean;
  /** collapsible sections only; default true */
  defaultOpen?: boolean;
  className?: string;
}

const HEADING_CLASS = 'text-lg font-semibold tracking-tight';

interface SectionTitleProps {
  id: string;
  title: string;
  level: 2 | 3;
  collapsible: boolean;
  open: boolean;
}

function SectionTitle({ id, title, level, collapsible, open }: SectionTitleProps) {
  const Heading = level === 2 ? 'h2' : 'h3';
  if (!collapsible) {
    return (
      <Heading id={id} className={HEADING_CLASS}>
        {title}
      </Heading>
    );
  }
  return (
    <Heading id={id} className={HEADING_CLASS}>
      <CollapsibleTrigger className="inline-flex items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <UiIcon.expand aria-hidden="true" className={cn('h-4 w-4 transition-transform', !open && '-rotate-90')} />
        {title}
      </CollapsibleTrigger>
    </Heading>
  );
}

/**
 * A titled block of a page (use instead of stacking cards): heading (h2 by default), optional
 * description and actions on the title row, 12 px to the content; `Page` puts 24 px between sections.
 * `collapsible` turns the title into a disclosure for secondary content (details, provenance).
 *
 * @example <Section title="Shift templates" actions={<Button size="sm">Add</Button>}>…</Section>
 */
export function Section(props: SectionProps) {
  const { title, description, actions, children, headingLevel = 2, collapsible = false } = props;
  const [open, setOpen] = useState(props.defaultOpen ?? true);
  const headingId = useId();
  const isOpen = !collapsible || open;
  return (
    <Collapsible open={isOpen} onOpenChange={setOpen} asChild>
      <section id={props.id} aria-labelledby={headingId} className={cn('space-y-3', props.className)}>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 space-y-1">
            <SectionTitle id={headingId} title={title} level={headingLevel} collapsible={collapsible} open={isOpen} />
            {description && <div className="text-sm text-muted-foreground">{description}</div>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        <CollapsibleContent>{children}</CollapsibleContent>
      </section>
    </Collapsible>
  );
}
