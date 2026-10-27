import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { ReasonSplitState } from '../hooks/use-reason-split';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { tonnesSplitGap } from '../model/declared-split';
import type { SplitMode, SplitRow } from '../model/reason-split';
import { ReasonCodeSelect } from './reason-code-select';

const UNIT_OF: Readonly<Record<SplitMode, string>> = { percent: '%', minutes: 'min', tonnes: 't' };
const VALUE_LABEL_OF: Readonly<Record<SplitMode, string>> = { percent: 'Percent of the stop', minutes: 'Minutes of the stop', tonnes: 'Tonnes of the shortfall' };

function SplitRowFields({ row, split }: { row: SplitRow; split: ReasonSplitState }) {
  const unit = UNIT_OF[split.mode];
  return (
    <li className="flex items-end gap-2" data-testid="split-row">
      <div className="min-w-0 flex-1">
        <ReasonCodeSelect id={`split-reason-${row.key}`} value={row.reasonCodeId} onChange={(reasonCodeId) => split.update(row.key, { reasonCodeId })} allowEmpty={false} />
      </div>
      <div className="flex w-32 items-center gap-1">
        <Input
          aria-label={VALUE_LABEL_OF[split.mode]}
          data-testid="split-value"
          inputMode="decimal"
          value={row.value}
          onChange={(e) => split.update(row.key, { value: e.target.value })}
        />
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
      <Button type="button" variant="ghost" size="sm" disabled={split.rows.length <= 2} onClick={() => split.remove(row.key)}>
        Remove
      </Button>
    </li>
  );
}

function SplitModeChoice({ split }: { split: ReasonSplitState }) {
  return (
    <RadioGroup className="flex gap-4" value={split.mode} onValueChange={(value) => split.setMode(value as SplitMode)} aria-label="Enter shares as">
      <div className="flex items-center gap-1">
        <RadioGroupItem id="split-mode-percent" value="percent" />
        <Label htmlFor="split-mode-percent" className="font-normal">Percent</Label>
      </div>
      {split.shortfall !== null ? (
        <div className="flex items-center gap-1">
          <RadioGroupItem id="split-mode-tonnes" value="tonnes" />
          <Label htmlFor="split-mode-tonnes" className="font-normal">Tonnes</Label>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <RadioGroupItem id="split-mode-minutes" value="minutes" disabled={!split.minutesAllowed} />
          <Label htmlFor="split-mode-minutes" className="font-normal">Minutes{split.minutesAllowed ? '' : ' (once the stop has ended)'}</Label>
        </div>
      )}
    </RadioGroup>
  );
}

function hintOf(split: ReasonSplitState): string {
  if (split.mode === 'percent') return 'The percents must add up to 100.';
  if (split.mode === 'tonnes') return `The tonnes must add up to the day's shortfall (${split.shortfall} t).`;
  return 'The minutes must add up to the length of the stop.';
}

function TonnesRemaining({ split, shortfall }: { split: ReasonSplitState; shortfall: number }) {
  const numbers = useNumberFormat();
  const gap = tonnesSplitGap(split.rows, shortfall);
  const message = gap ? `${numbers.number(gap.tonnes, 3)} t ${gap.side === 'remaining' ? 'still to place.' : 'over the shortfall.'}` : null;
  return (
    <p className={message ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'} data-testid="split-tonnes-remaining" role="status">
      {message ?? 'The tonnes add up to the shortfall.'}
    </p>
  );
}

/**
 * D-T5 "Split across several reasons": the coder gives each reason a percent of the stop or its minutes. The
 * server normalises the weights, makes the largest the stop's reason and refuses a split that does not add up
 * (its message is shown by the dialog's error area). `percentOnly` (bulk coding): the selected stops differ in
 * length, so the minutes option is not offered.
 */
export function ReasonSplitSection({ split, percentOnly = false }: { split: ReasonSplitState; percentOnly?: boolean }) {
  return (
    <section className="space-y-2" data-testid="reason-split">
      <div className="flex items-center gap-2">
        <Checkbox id="split-enabled" data-testid="split-enabled" checked={split.enabled} onCheckedChange={(value) => split.setEnabled(value === true)} />
        <Label htmlFor="split-enabled" className="font-normal">Split across several reasons</Label>
      </div>
      {split.enabled && (
        <>
          {percentOnly ? <p className="text-xs text-muted-foreground" data-testid="split-percent-only">Bulk coding splits by percent</p> : <SplitModeChoice split={split} />}
          <ul className="space-y-2">
            {split.rows.map((row) => (
              <SplitRowFields key={row.key} row={row} split={split} />
            ))}
          </ul>
          <Button type="button" variant="outline" size="sm" onClick={split.add}>
            Add reason
          </Button>
          <p className="text-xs text-muted-foreground">
            {hintOf(split)} The largest share becomes the {split.shortfall !== null ? 'event’s' : 'stop’s'} reason.
          </p>
          {split.mode === 'tonnes' && split.shortfall !== null && <TonnesRemaining split={split} shortfall={split.shortfall} />}
        </>
      )}
    </section>
  );
}
