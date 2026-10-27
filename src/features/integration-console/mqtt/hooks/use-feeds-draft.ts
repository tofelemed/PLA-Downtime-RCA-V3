import { useState } from 'react';
import { useUpdateConnection } from '@/api/v2/queries/integration-connections';
import type { ConnectionView } from '@/api/v2/types/integrations';
import { feedErrorsFromError, mergeFeedErrors } from '../model/feed-server-errors';
import { feedErrors, feedsFromProfile, feedsProfileOf, type FeedErrors, type FeedForm } from '../model/feeds';

export interface FeedsDraft {
  feeds: FeedForm[];
  /** client rules and the server's 422 field errors, per feed */
  feedErrors: FeedErrors;
  /** one entry per problem (the save bar counts them) */
  errors: Record<string, string>;
  /** the merge patch the save would send (null = nothing changed) */
  patch: { feeds: Record<string, unknown>[] } | null;
  change: (feeds: FeedForm[]) => void;
  reset: () => void;
  save: () => Promise<void>;
  savedAt: string | null;
  failed: unknown;
  isPending: boolean;
}

const storedFeeds = (connection: ConnectionView) => feedsFromProfile(connection.endpointConfig.payloadProfile);

/** Client problems flattened to `feed-<n>-<field>` keys for counting. */
function flatErrors(errors: FeedErrors): Record<string, string> {
  const flat: Record<string, string> = errors.list ? { list: errors.list } : {};
  for (const [index, problems] of Object.entries(errors.byFeed)) {
    const { fields, ...rest } = problems;
    for (const [key, message] of Object.entries(rest)) if (message) flat[`feed-${index}-${key}`] = message;
    for (const [key, message] of Object.entries(fields ?? {})) flat[`feed-${index}-field-${key}`] = message;
  }
  return flat;
}

/**
 * Feeds profile editor state: a draft of the stored feeds and the save as
 * `payloadProfilePatch: { feeds }` under If-Match (a merge patch replaces the array whole; the
 * transport block is never sent). Only edited field paths are stored.
 */
export function useFeedsDraft(connection: ConnectionView): FeedsDraft {
  const [feeds, setFeeds] = useState<FeedForm[]>(() => storedFeeds(connection));
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const update = useUpdateConnection();
  const client = feedErrors(feeds);
  const next = feedsProfileOf(feeds).feeds;
  const dirty = JSON.stringify(next) !== JSON.stringify(feedsProfileOf(storedFeeds(connection)).feeds);
  const patch = dirty ? { feeds: next } : null;
  const reset = () => {
    setFeeds(storedFeeds(connection));
    update.reset();
  };
  const save = async () => {
    if (!patch || Object.keys(flatErrors(client)).length > 0) return;
    const saved = await update.submit({ connection, body: { payloadProfilePatch: patch } }).catch(() => null);
    if (!saved) return;
    setFeeds(storedFeeds(saved));
    setSavedAt(new Date().toISOString());
  };
  return {
    feeds,
    feedErrors: mergeFeedErrors(client, feedErrorsFromError(update.error)),
    errors: flatErrors(client),
    patch,
    change: setFeeds,
    reset,
    save,
    savedAt,
    failed: update.error,
    isPending: update.isPending,
  };
}
