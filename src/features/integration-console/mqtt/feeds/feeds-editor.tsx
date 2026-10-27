import { Button } from '@/components/ui/button';
import type { FeedPurpose } from '../model/feed-templates';
import { MAX_FEEDS, newFeed, withPurpose, type FeedErrors, type FeedForm } from '../model/feeds';
import { FeedCard } from './feed-card';

export interface FeedsEditorProps {
  feeds: FeedForm[];
  errors: FeedErrors;
  onChange: (feeds: FeedForm[]) => void;
  /** non-writers: everything shown, nothing editable */
  readOnly?: boolean;
}

/**
 * The feeds of one MQTT connection (plans/MQTT_FEEDS.md): a card per feed and buttons to add a PLA or
 * a downtime feed (at most eight). Each card owns its purpose, topic, booking and field mapping.
 */
export function FeedsEditor({ feeds, errors, onChange, readOnly = false }: FeedsEditorProps) {
  const replace = (index: number, next: FeedForm) => onChange(feeds.map((feed, at) => (at === index ? next : feed)));
  const add = (purpose: FeedPurpose) => onChange([...feeds, newFeed(purpose, feeds)]);
  const full = feeds.length >= MAX_FEEDS;
  return (
    <div className="space-y-3" data-testid="feeds-editor">
      {errors.list && (
        <p role="alert" className="text-sm text-destructive" data-testid="feeds-error">
          {errors.list}
        </p>
      )}
      {feeds.length === 0 && <p className="text-sm text-muted-foreground">No feeds yet. Add the PLA feed and the downtime feed OT publishes.</p>}
      {feeds.map((feed, index) => (
        <FeedCard
          key={`${index}-${feed.id}`}
          feed={feed}
          index={index}
          errors={errors.byFeed[index] ?? {}}
          readOnly={readOnly}
          canRemove={feeds.length > 1}
          onChange={(patch) => replace(index, { ...feed, ...patch })}
          onPurpose={(purpose) => replace(index, withPurpose(feed, purpose, feeds))}
          onRemove={() => onChange(feeds.filter((_feed, at) => at !== index))}
        />
      ))}
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={full} onClick={() => add('pla')} data-testid="feed-add-pla">
            Add PLA feed
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={full} onClick={() => add('downtime')} data-testid="feed-add-downtime">
            Add downtime feed
          </Button>
        </div>
      )}
    </div>
  );
}
