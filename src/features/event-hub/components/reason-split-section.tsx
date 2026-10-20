import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { ReasonSplitState } from '../hooks/use-reason-split';
import type { SplitMode, SplitRow } from '../model/reason-split';
import { ReasonCodeSelect } from './reason-code-select';

function SplitRowFields({ row, split }: { row: SplitRow; split: ReasonSplitState }) {
  const unit = split.mode === 'percent' ? '%' : 'min';
  return (
    <li className="flex items-end gap-2" data-testid="split-row">
      <div className="min-w-0 flex-1">
        <ReasonCodeSelect id={`split-reason-${row.key}`} value={row.reasonCodeId} onChange={(reasonCodeId) => split.update(row.key, { reasonCodeId })} allowEmpty={false} />
      </div>
      <div className="flex w-32 items-center gap-1">
        <Input
          aria-label={split.mode === 'percent' ? 'Percent of the stop' : 'Minutes of the stop'}
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
      <div className="flex items-center gap-1">
        <RadioGroupItem id="split-mode-minutes" value="minutes" disabled={!split.minutesAllowed} />
        <Label htmlFor="split-mode-minutes" className="font-normal">Minutes{split.minutesAllowed ? '' : ' (once the stop has ended)'}</Label>
      </div>
    </RadioGroup>
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
            {split.mode === 'percent' ? 'The percents must add up to 100.' : 'The minutes must add up to the length of the stop.'} The largest share becomes the stop’s reason.
          </p>
        </>
      )}
    </section>
  );
}
