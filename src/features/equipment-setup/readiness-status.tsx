import { STATUS_LABELS, stepReadiness } from './readiness-model';
import type { ReadinessStatus } from '@/api/v2/types/equipment-readiness';
import { Badge } from '@/components/ui/badge';
import { useReadinessChecks } from './readiness-context';

export function ReadinessBadge({ status }: { status: ReadinessStatus }) {
  return <Badge variant={status === 'missing' || status === 'needs_attention' ? 'destructive' : 'secondary'}>{STATUS_LABELS[status]}</Badge>;
}
export function StepReadinessBadge({ stepId }: { stepId: string }) {
  const snapshot = useReadinessChecks();
  const checks = snapshot?.checks.filter((check) => check.stepId === stepId) ?? [];
  if (!checks.length) return null;
  return <span aria-label="Automatic check status"><ReadinessBadge status={stepReadiness(checks)} /></span>;
}
