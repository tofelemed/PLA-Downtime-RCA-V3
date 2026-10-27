import { Input } from '@/components/ui/input';
import { IconButton } from '@/features/ux-kit/icon-button';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { ActionIcon } from '@/lib/icons';
import { Field } from '../../components/field';
import { NativeSelect } from '../../components/native-select';
import { FEED_PURPOSE_LABELS, FEED_PURPOSES, FEED_TOPIC_PLACEHOLDERS, type FeedPurpose } from '../model/feed-templates';
import { DURATION_UNITS, type DurationUnit, type FeedForm, type FeedProblems } from '../model/feeds';
import { FeedBookingFields } from './feed-booking-fields';
import { FeedExample } from './feed-example';
import { FeedFieldMapping } from './feed-field-mapping';

const DURATION_LABELS: Readonly<Record<DurationUnit, string>> = { s: 'Seconds', min: 'Minutes', h: 'Hours' };

export interface FeedCardProps {
  feed: FeedForm;
  index: number;
  errors: FeedProblems;
  readOnly: boolean;
  canRemove: boolean;
  onChange: (patch: Partial<FeedForm>) => void;
  onPurpose: (purpose: FeedPurpose) => void;
  onRemove: () => void;
}

/** One feed: purpose, topic, where it is booked (PLA) or how durations read (downtime), the mapping. */
export function FeedCard({ feed, index, errors, readOnly, canRemove, onChange, onPurpose, onRemove }: FeedCardProps) {
  const { number } = useNumberFormat();
  const id = `feed-${feed.id}`;
  return (
    <section aria-labelledby={`${id}-title`} className="min-w-0 space-y-3 rounded-lg border p-3" data-testid="feed-card" data-feed-id={feed.id} data-purpose={feed.purpose}>
      <div className="flex items-center justify-between gap-2">
        <h3 id={`${id}-title`} className="text-sm font-semibold">
          Feed {number(index + 1)} <span className="font-normal text-muted-foreground">({feed.id})</span>
        </h3>
        {!readOnly && canRemove && <IconButton icon={ActionIcon.delete} label={`Remove feed ${feed.id}`} onClick={onRemove} data-testid="feed-remove" />}
      </div>
      {errors.id && <p className="text-xs text-destructive">{errors.id}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={`${id}-purpose`} label="Purpose" error={errors.purpose} hint="Changing the purpose resets the field mapping to that template.">
          <NativeSelect
            id={`${id}-purpose`}
            testId="feed-purpose"
            value={feed.purpose}
            disabled={readOnly}
            options={FEED_PURPOSES.map((purpose) => ({ value: purpose, label: FEED_PURPOSE_LABELS[purpose] }))}
            onChange={(purpose) => onPurpose(purpose as FeedPurpose)}
          />
        </Field>
        <Field id={`${id}-topic`} label="Topic" required error={errors.topic} hint="The topic OT publishes on (+ matches one level, # the rest).">
          <Input id={`${id}-topic`} data-testid="feed-topic" className="font-mono text-xs" placeholder={FEED_TOPIC_PLACEHOLDERS[feed.purpose]} value={feed.topic} readOnly={readOnly} onChange={(event) => onChange({ topic: event.target.value })} />
        </Field>
        {feed.purpose === 'pla' ? (
          <FeedBookingFields feed={feed} errors={errors} readOnly={readOnly} onChange={onChange} />
        ) : (
          <Field id={`${id}-duration`} label="Duration unit" error={errors.durationUnit} hint="Unit of the duration field.">
            <NativeSelect
              id={`${id}-duration`}
              testId="feed-duration-unit"
              value={feed.durationUnit}
              disabled={readOnly}
              options={DURATION_UNITS.map((unit) => ({ value: unit, label: DURATION_LABELS[unit] }))}
              onChange={(unit) => onChange({ durationUnit: unit as DurationUnit })}
            />
          </Field>
        )}
      </div>
      <FeedFieldMapping feed={feed} errors={errors.fields} readOnly={readOnly} onChange={(fields) => onChange({ fields })} />
      <FeedExample feed={feed} />
    </section>
  );
}
