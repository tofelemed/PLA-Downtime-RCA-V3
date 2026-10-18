import { STATUS_LABELS, stepReadiness } from './readiness-model';
import type { ReadinessStatus } from '@/api/v2/types/equipment-readiness';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import type { StatusTone } from '@/features/ux-kit/status-tone';
import { useReadinessChecks } from './readiness-context';

/** Missing blocks the setup (red); "needs attention" is a data check to look at (amber). */
const READINESS_TONES: Readonly<Record<ReadinessStatus, StatusTone>> = {
  ready: 'success',
  missing: 'danger',
  needs_attention: 'warning',
  not_checked: 'neutral',
  optional: 'neutral',
};

export function ReadinessBadge({ status }: { status: ReadinessStatus }) {
  return <StatusBadge tone={READINESS_TONES[status]}>{STATUS_LABELS[status]}</StatusBadge>;
}
export function StepReadinessBadge({ stepId }: { stepId: string }) {
  const snapshot = useReadinessChecks();
  const checks = snapshot?.checks.filter((check) => check.stepId === stepId) ?? [];
  if (!checks.length) return null;
  return <span aria-label="Automatic check status"><ReadinessBadge status={stepReadiness(checks)} /></span>;
}
