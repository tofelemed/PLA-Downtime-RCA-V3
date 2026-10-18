import type { ReactNode } from 'react';
import { INTEGRATION_TONES } from '@/features/ux-kit/labels';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import { toneOf } from '@/features/ux-kit/status-tone';
import type { Tone } from '../model/job-states';

/** Console health badge: `ok / busy / idle / warning / error` on the shared tones; the text says the state. */
export function ToneBadge({ tone, children, testId }: { tone: Tone; children: ReactNode; testId?: string }) {
  return (
    <StatusBadge tone={toneOf(INTEGRATION_TONES, tone)} data-testid={testId} data-tone={tone}>
      {children}
    </StatusBadge>
  );
}
