import { refusalOf } from '@/features/plans-profiles-calendars/model/refusal';
import { PlantTime } from '@/features/ux-kit/plant-time';

/** The rule versions a refused draft overlaps (409 with `details.conflicts`), under the red alert; nothing otherwise. */
export function ImpactRuleConflicts({ error, timezone }: { error: unknown; timezone: string }) {
  const conflicts = refusalOf(error)?.conflicts ?? [];
  if (conflicts.length === 0) return null;
  return (
    <div className="text-sm" data-testid="impact-rule-conflicts">
      <p className="font-medium">Rules already in force in this time</p>
      <ul className="list-disc pl-5">
        {conflicts.map((conflict, index) => (
          <li key={`${conflict.id ?? index}-${conflict.label}`} data-testid="refusal-conflict">
            {conflict.label}: <PlantTime iso={conflict.from} tz={timezone} withDate /> →{' '}
            {conflict.to ? <PlantTime iso={conflict.to} tz={timezone} withDate /> : 'open-ended'}
          </li>
        ))}
      </ul>
    </div>
  );
}
