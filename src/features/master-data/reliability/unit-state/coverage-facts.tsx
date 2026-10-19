import type { StateCoverage } from '@/api/v2/types/reliability';
import { Badge } from '@/components/ui/badge';
import type { ReliabilityFormat } from '../shared/use-reliability-format';
import { availabilityText, durationOrNone, ratio } from './coverage-facts-text';

export function CoverageFacts({ coverage, format }: { coverage: StateCoverage; format: ReliabilityFormat }) {
  const availability = availabilityText(coverage, format);
  return (
    <dl className="grid grid-cols-1 gap-x-3 gap-y-1 text-sm sm:grid-cols-[14rem_1fr]" data-testid="coverage-facts">
      <dt className="text-muted-foreground">Availability</dt>
      <dd className="flex flex-wrap items-center gap-2">
        {availability.text}
        {availability.bounded && <Badge variant="outline">Provisional</Badge>}
      </dd>
      <dt className="text-muted-foreground">Known-data coverage</dt>
      <dd>{ratio(coverage.coverage, format)}</dd>
      <dt className="text-muted-foreground">On observed time only</dt>
      <dd>{ratio(coverage.knownTimeAvailability, format)} (not the certified availability)</dd>
      <dt className="text-muted-foreground">Scheduled</dt>
      <dd>{format.duration(coverage.scheduledSeconds)}</dd>
      <dt className="text-muted-foreground">Running · known stopped · unknown</dt>
      <dd>
        {durationOrNone(coverage.runningSeconds, format)} · {durationOrNone(coverage.knownStoppedSeconds, format)} · {durationOrNone(coverage.unknownSeconds, format)}
      </dd>
    </dl>
  );
}
