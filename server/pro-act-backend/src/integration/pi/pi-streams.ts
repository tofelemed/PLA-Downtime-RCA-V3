import { PiHttpClient, PiRequestError } from './pi-http-client';
import { PiTimedValue } from './pi-signal-envelope';

/** Recorded values of one stream as `streamsets/recorded` returns them. */
export interface PiStreamValues {
  webId: string;
  items: PiTimedValue[];
}

/**
 * `GET streamsets/recorded` for several streams in one call (PI07): `boundaryType=Inside`, at most
 * `maxCount` values per stream. A stream PI answers with errors (unknown WebId, no access) fails the read
 * with a non-retryable error naming it — a misconfigured signal is never skipped silently.
 */
export async function readRecorded(
  client: PiHttpClient,
  request: { webIds: string[]; start: string; end: string; maxCount: number },
): Promise<PiStreamValues[]> {
  const query = new URLSearchParams();
  for (const webId of request.webIds) query.append('webId', webId);
  query.set('startTime', request.start);
  query.set('endTime', request.end);
  query.set('boundaryType', 'Inside');
  query.set('maxCount', String(request.maxCount));
  const reply = await client.get<{ Items?: unknown }>(
    `streamsets/recorded?${query.toString()}`,
  );
  const streams = Array.isArray(reply?.Items)
    ? (reply.Items as Record<string, unknown>[])
    : [];
  return request.webIds.map((webId) => {
    const stream = streams.find((candidate) => candidate.WebId === webId);
    if (!stream || (Array.isArray(stream.Errors) && stream.Errors.length > 0)) {
      throw new PiRequestError(
        `PI returned no recorded values for stream ${webId}: ${JSON.stringify(stream?.Errors ?? 'missing')}`,
        'rejected',
      );
    }
    return { webId, items: timedValues(stream.Items) };
  });
}

/** `GET streams/{webId}/summary` — time-weighted `Total` per `intervalMinutes` over `[start, end)`. */
export async function readTotals(
  client: PiHttpClient,
  request: {
    webId: string;
    start: string;
    end: string;
    intervalMinutes: number;
  },
): Promise<Array<{ start: string; value: PiTimedValue }>> {
  const reply = await client.get<{ Items?: unknown }>(
    `streams/${encodeURIComponent(request.webId)}/summary`,
    {
      startTime: request.start,
      endTime: request.end,
      summaryType: 'Total',
      calculationBasis: 'TimeWeighted',
      summaryDuration: `${request.intervalMinutes}m`,
    },
  );
  const items = Array.isArray(reply?.Items)
    ? (reply.Items as Record<string, unknown>[])
    : [];
  return items
    .filter((item) => item.Type === 'Total' && isTimedValue(item.Value))
    .map((item) => {
      const value = item.Value as PiTimedValue;
      return { start: new Date(value.Timestamp).toISOString(), value };
    });
}

export function timedValues(value: unknown): PiTimedValue[] {
  return Array.isArray(value) ? value.filter(isTimedValue) : [];
}

function isTimedValue(value: unknown): value is PiTimedValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { Timestamp?: unknown }).Timestamp === 'string' &&
    !Number.isNaN(Date.parse((value as { Timestamp: string }).Timestamp))
  );
}
