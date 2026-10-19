import type { EquipmentReadinessView } from '@/api/v2/types/equipment-readiness';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { formatDateTime, useCalendarPreference } from '@/lib/dates';
import { useEquipmentJourney } from './journey-context';
import { canOpenStep, setupStep, stepPrerequisite } from './setup-steps';
import { ReadinessBadge } from './readiness-status';

export function ReadinessResults({ snapshot, timezone }: { snapshot: EquipmentReadinessView; timezone: string }) {
  const context = useEquipmentJourney();
  const capabilities = useCapabilities();
  const numbers = useNumberFormat();
  const preference = useCalendarPreference();
  const priority = ['missing', 'needs_attention', 'not_checked', 'ready', 'optional'];
  const checks = [...snapshot.checks].sort((a, b) => priority.indexOf(a.status) - priority.indexOf(b.status));
  const counts = (status: string) => numbers.number(snapshot.checks.filter((check) => check.status === status).length);
  return <div className="space-y-3">
    <p role="status" className="text-sm">Passed {counts('ready')} · Missing {counts('missing')} · Needs attention {counts('needs_attention')} · Not checked {counts('not_checked')} · Optional {counts('optional')}</p>
    <p className="text-xs text-muted-foreground">Last checked: {formatDateTime(snapshot.asOf, { ...preference, timeZone: timezone, withZone: true })}. Results apply to the product, mode and window above. Manual review and period evidence gates remain required.</p>
    <details open={snapshot.checks.some((check) => check.status === 'missing' || check.status === 'needs_attention')}>
      <summary className="cursor-pointer font-medium">Readiness checks and next actions</summary>
      <ul aria-label="Equipment readiness checks" className="mt-3 grid gap-3 lg:grid-cols-2">
        {checks.map((check) => {
          const step = setupStep(check.stepId);
          const blocked = !context?.journey || !canOpenStep(step, capabilities) || !!stepPrerequisite(step, context.journey);
          return <li key={check.id} className="space-y-2 rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium">{check.label}</h3><ReadinessBadge status={check.status} /></div>
            <p className="text-sm text-muted-foreground">{numbers.text(check.detail)}</p>
            {check.coverage !== null && <p className="text-xs">Coverage: {numbers.percent(check.coverage * 100, 1)}</p>}
            <Button size="sm" variant="link" className="h-auto p-0" disabled={blocked} onClick={() => context?.openStep(check.stepId)}>Open {step.title}</Button>
          </li>;
        })}
      </ul>
    </details>
  </div>;
}
