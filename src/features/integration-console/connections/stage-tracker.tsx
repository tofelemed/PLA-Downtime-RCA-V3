import { PlantTime } from '@/features/ux-kit/plant-time';
import { StatusIcon } from '@/lib/icons';
import type { StageResult } from '../model/stages';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

const ICON = { done: StatusIcon.success, attention: StatusIcon.warning, pending: StatusIcon.pending } as const;
const STATUS_TEXT = { done: 'done', attention: 'needs attention', pending: 'not done yet' } as const;
const COLOR = { done: 'text-green-600', attention: 'text-amber-600', pending: 'text-muted-foreground' } as const;

/** UX06 checklist of one connection: every stage with its result and time. */
export function StageTracker({ stages, timezone }: { stages: readonly StageResult[]; timezone: string }) {
  const { number } = useNumberFormat();
  return (
    <ol className="space-y-2" aria-label="Integration stages" data-testid="stage-tracker">
      {stages.map((stage, index) => {
        const Icon = ICON[stage.status];
        return (
          <li key={stage.key} className="flex items-start gap-2 text-sm" data-testid="stage" data-stage={stage.key} data-status={stage.status}>
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${COLOR[stage.status]}`} aria-hidden />
            <div>
              <p className="font-medium">
                {number(index + 1)}. {stage.label} <span className="sr-only">({STATUS_TEXT[stage.status]})</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {stage.detail}
                {stage.at && (
                  <>
                    {' '}
                    · <PlantTime iso={stage.at} tz={timezone} withDate />
                  </>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
