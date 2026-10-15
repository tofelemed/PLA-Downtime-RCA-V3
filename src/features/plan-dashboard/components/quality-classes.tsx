import type { QualityClassesView } from '@/api/v2/types/periods';
import { Quantity } from '@/features/ux-kit/quantity';

const ROWS: ReadonlyArray<[keyof QualityClassesView, string]> = [
  ['firstPassGood', 'First-pass good'],
  ['wideSpec', 'Wide-spec grade (good)'],
  ['downgrade', 'Downgrade / off-grade'],
  ['transitionOffGrade', 'Transition off-grade'],
  ['scrap', 'Scrap'],
  ['rework', 'Sent to rework'],
  ['unclassified', 'Rejects without a disposition'],
  ['recovered', 'Recovered from earlier rework'],
  ['reprocessedInput', 'Reprocessed through the meter (not new output)'],
];

const shown = (value: string | string[] | null) =>
  typeof value === 'string' && value !== '0';

/**
 * SME E3: what the period's output became, as the server classified it from the approved lot
 * dispositions — first-pass good apart from intentional wide-spec, each kind of defect, and material
 * recovered from earlier rework (saleable again, but never new output or first-pass good).
 */
export function QualityClasses({ classes, uom }: { classes: QualityClassesView; uom: string | null }) {
  const rows = ROWS.filter(([key]) => key === 'firstPassGood' || shown(classes[key]));
  return (
    <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-xs" data-testid="quality-classes">
      {rows.map(([key, label]) => (
        <div key={key} className="contents" data-class={key}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="text-right tabular-nums">
            <Quantity value={classes[key] as string | null} uom={uom} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
