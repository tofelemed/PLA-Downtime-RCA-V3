import type { HTMLAttributes, ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import type { AppIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { TONE_SURFACE_CLASS, type StatusTone } from './status-tone';

export interface StatusBadgeProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  tone: StatusTone;
  /** the status in words — always present, colour is never the only cue (WCAG 1.4.1) */
  children: ReactNode;
  /** optional status icon from `@/lib/icons`; decorative (the text carries the meaning) */
  icon?: AppIcon;
  size?: 'sm' | 'md';
}

const SIZE_CLASS: Readonly<Record<NonNullable<StatusBadgeProps['size']>, string>> = {
  sm: 'gap-1',
  md: 'gap-1.5 px-3 py-1',
};

/** One status badge for the whole app (UX_AUDIT C-2): tone + words, optional icon. */
export function StatusBadge({ tone, children, icon: Icon, size = 'sm', className, ...rest }: StatusBadgeProps) {
  return (
    <Badge variant="outline" data-tone={tone} {...rest} className={cn(TONE_SURFACE_CLASS[tone], SIZE_CLASS[size], className)}>
      {Icon && <Icon aria-hidden="true" className="h-3 w-3 shrink-0" />}
      {children}
    </Badge>
  );
}
