import {
  SampleRecord,
  SampleRequest,
  SourceSample,
} from '../../intake/adapters/adapter.interface';
import { PiEventFrame } from '../pi-frame-ingest.service';
import { readAttributes } from './pi-attribute-reader';
import { searchFramePage } from './pi-frame-search';
import { PiHttpClient } from './pi-http-client';
import { piEndTimeIso } from './pi-time';

/**
 * Discovery sample (plan 3.7, UX06 "discover → map sample"): one page of event frames overlapping the
 * window, with their attribute values, so the console can pick templates and elements and preview the
 * typed mapping. One frame more than `limit` is asked for to tell whether the window holds more.
 */
export async function samplePiFrames(
  client: PiHttpClient,
  request: SampleRequest,
  useBatch: boolean,
): Promise<SourceSample> {
  const page = await searchFramePage(
    client,
    {
      scopeType: request.scopeType,
      scopeId: request.scopeId,
      templateName: request.templateName,
    },
    {
      start: request.from.toISOString(),
      end: request.to.toISOString(),
      startIndex: 0,
      maxCount: request.limit + 1,
    },
  );
  const frames = page.slice(0, request.limit);
  const attributes =
    frames.length > 0
      ? (
          await readAttributes(
            client,
            frames.map((frame) => frame.WebId),
            useBatch,
          )
        ).values
      : new Map<string, Record<string, unknown>>();
  return {
    records: frames.map((frame) =>
      toRecord(frame, attributes.get(frame.WebId) ?? {}),
    ),
    templates: templateCounts(frames),
    truncated: page.length > request.limit,
  };
}

function toRecord(
  frame: PiEventFrame,
  attributes: Record<string, unknown>,
): SampleRecord {
  const element = frame.PrimaryReferencedElement;
  return {
    sourceObjectId: frame.WebId,
    name: frame.Name ?? null,
    templateName: frame.TemplateName ?? null,
    startTime: new Date(frame.StartTime).toISOString(),
    endTime: piEndTimeIso(frame.EndTime),
    element: element
      ? { webId: element.WebId ?? null, path: element.Path ?? null }
      : null,
    attributes,
  };
}

function templateCounts(
  frames: readonly PiEventFrame[],
): SourceSample['templates'] {
  const counts = new Map<string, number>();
  for (const frame of frames) {
    const name = frame.TemplateName ?? '*NoTemplate*';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, records]) => ({ name, records }))
    .sort((a, b) => b.records - a.records || a.name.localeCompare(b.name));
}
