import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import type { Tone } from '../model/job-states';

const CLASSES: Record<Tone, string> = {
  ok: 'border-green-600 text-green-700 dark:text-green-400',
  busy: 'border-blue-600 text-blue-700 dark:text-blue-400',
  idle: 'border-muted-foreground text-muted-foreground',
  warning: 'border-amber-600 text-amber-700 dark:text-amber-400',
  error: 'border-destructive text-destructive',
};

/** Outline badge coloured by tone; the text always says the state (colour is never the only cue). */
export function ToneBadge({ tone, children, testId }: { tone: Tone; children: ReactNode; testId?: string }) {
  return (
    <Badge variant="outline" className={CLASSES[tone]} data-testid={testId} data-tone={tone}>
      {children}
    </Badge>
  );
}
