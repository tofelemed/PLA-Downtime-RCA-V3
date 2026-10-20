import { PiHttpClient, PiRequestError } from './pi-http-client';
import { PiTimedValue } from './pi-signal-envelope';

/** Recorded values of one stream as `streamsets/recorded` returns them. */
export interface PiStreamValues {
  webId: string;
  items: PiTimedValue[];
}

/** WebIds per `streamsets/recorded` request: keeps the query string far below PI / IIS URL limits. */
const RECORDED_CHUNK = 40;

/**
 * `GET streamsets/recorded` for several streams (PI07), at most 40 WebIds per call so many signals never
 * exceed the URL length limit: `boundaryType=Inside`, at most `maxCount` values per stream. A stream PI
 * answers with errors (unknown WebId, no access) fails the read with a non-retryable error naming it — a
 * misconfigured signal is never skipped silently.
 */
export async function readRecorded(
  client: PiHttpClient,
  request: { webIds: string[]; start: string; end: string; maxCount: number },
): Promise<PiStreamValues[]> {
  const streams: Record<string, unknown>[] = [];
  for (let from = 0; from < request.webIds.length; from += RECORDED_CHUNK) {
    const chunk = request.webIds.slice(from, from + RECORDED_CHUNK);
    streams.push(
      ...(await recordedChunk(client, { ...request, webIds: chunk })),
    );
  }
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

async function recordedChunk(
  client: PiHttpClient,
  request: { webIds: string[]; start: string; end: string; maxCount: number },
): Promise<Record<string, unknown>[]> {
  const query = new URLSearchParams();
  for (const webId of request.webIds) query.append('webId', webId);
  query.set('startTime', request.start);
  query.set('endTime', request.end);
  query.set('boundaryType', 'Inside');
  query.set('maxCount', String(request.maxCount));
  const reply = await client.get<{ Items?: unknown }>(
    `streamsets/recorded?${query.toString()}`,
  );
  return Array.isArray(reply?.Items)
    ? (reply.Items as Record<string, unknown>[])
    : [];
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
