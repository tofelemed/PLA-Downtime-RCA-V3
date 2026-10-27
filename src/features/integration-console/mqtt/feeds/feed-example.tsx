import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { examplePayloadText, type FeedForm } from '../model/feeds';

/** The message this feed reads, as JSON to hand to OT (the owner's sample with this feed's paths). */
export function FeedExample({ feed }: { feed: FeedForm }) {
  const [copied, setCopied] = useState(false);
  const example = examplePayloadText(feed.purpose, feed.fields);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(example);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <details className="rounded-md border p-3" data-testid="feed-example">
      <summary className="cursor-pointer text-sm font-medium">Example payload for OT</summary>
      <div className="mt-2 space-y-2">
        <pre className="max-h-72 overflow-auto rounded bg-muted p-2 text-xs" tabIndex={0} aria-label={`Example payload of feed ${feed.id}`} data-testid="feed-example-json">
          {example}
        </pre>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => void copy()} data-testid="feed-example-copy">
            Copy example
          </Button>
          <span role="status" className="text-xs text-muted-foreground">{copied ? 'Copied' : ''}</span>
        </div>
      </div>
    </details>
  );
}
