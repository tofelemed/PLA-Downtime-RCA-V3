import { AdapterError } from '../adapter-error';
import { parseBrokerUrl } from './broker-url';
import { effectiveClientId } from './mqtt-config';
import { topicFiltersOverlap } from './topic-filter';

/** Another active MQTT connection of the same tenant (id, name and stored endpoint configuration). */
export interface FeedPeer {
  id: string;
  displayName: string;
  endpointConfig: Record<string, unknown>;
}

export interface FeedCandidate {
  endpointConfig: Readonly<Record<string, unknown>>;
  /** null while the connection is being created (its derived client id is unique by construction) */
  connectionId: string | null;
}

export interface DuplicateFeed {
  peerId: string;
  peerName: string;
  reason: 'overlapping_topics' | 'same_client_id';
  detail: string;
}

interface Feed {
  endpoint: string;
  topics: string[];
  clientId: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The comparable parts of a configuration; null when it has no parsable broker (never a duplicate). */
function feedOf(
  config: Readonly<Record<string, unknown>>,
  connectionId: string | null,
): Feed | null {
  const block = config.mqtt;
  if (!isRecord(block)) return null;
  const broker = parseBrokerUrl(block.brokerUrl);
  if (!broker) return null;
  const topics = Array.isArray(block.topics)
    ? block.topics.filter((entry): entry is string => typeof entry === 'string')
    : [];
  const configured =
    typeof block.clientId === 'string' ? block.clientId : undefined;
  const explicit = (configured ?? '').trim().length > 0;
  return {
    endpoint: broker.normalized,
    topics,
    clientId:
      explicit || connectionId
        ? effectiveClientId(configured, connectionId ?? '')
        : null,
  };
}

function overlapOf(first: string[], second: string[]): string | null {
  for (const a of first) {
    for (const b of second) {
      if (topicFiltersOverlap(a, b)) return `${a} overlaps ${b}`;
    }
  }
  return null;
}

/**
 * Duplicate-feed guard (design §3, reference CHG-062): the same normalised endpoint and either an
 * overlapping topic filter or the same effective client id as another active MQTT connection of the
 * tenant. A duplicated feed would double every event; the same client id would evict the live subscriber.
 */
export function findDuplicateFeed(
  candidate: FeedCandidate,
  peers: readonly FeedPeer[],
): DuplicateFeed | null {
  const mine = feedOf(candidate.endpointConfig, candidate.connectionId);
  if (!mine) return null;
  for (const peer of peers) {
    if (peer.id === candidate.connectionId) continue;
    const theirs = feedOf(peer.endpointConfig, peer.id);
    if (!theirs || theirs.endpoint !== mine.endpoint) continue;
    const overlap = overlapOf(mine.topics, theirs.topics);
    if (overlap) {
      return {
        peerId: peer.id,
        peerName: peer.displayName,
        reason: 'overlapping_topics',
        detail: overlap,
      };
    }
    if (mine.clientId && mine.clientId === theirs.clientId) {
      return {
        peerId: peer.id,
        peerName: peer.displayName,
        reason: 'same_client_id',
        detail: `client id ${mine.clientId}`,
      };
    }
  }
  return null;
}

/** Throws the non-retryable `DUPLICATE_FEED` adapter error (the connection service answers 422). */
export function assertNoDuplicateFeed(
  candidate: FeedCandidate,
  peers: readonly FeedPeer[],
): void {
  const duplicate = findDuplicateFeed(candidate, peers);
  if (!duplicate) return;
  const why =
    duplicate.reason === 'overlapping_topics'
      ? `topic filter ${duplicate.detail}`
      : duplicate.detail;
  throw new AdapterError(
    `Duplicate MQTT feed: connection "${duplicate.peerName}" (${duplicate.peerId}) already subscribes to the same broker with ${why}`,
    'DUPLICATE_FEED',
    false,
    'duplicate_feed',
  );
}
