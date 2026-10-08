import { OPEN_SENTINEL, SimFrame } from './sim-model';

export interface FrameInput {
  webId: string;
  start: Date;
  /** null = still open (delivered with the sentinel) */
  end: Date | null;
  template?: string;
  element?: { WebId: string; Path: string | null } | null;
  attributes?: Record<string, unknown>;
  databaseWebId?: string;
}

/** One simulator frame in the `HDPE` database (test data only). */
export function simFrame(input: FrameInput): SimFrame {
  return {
    WebId: input.webId,
    Name: `frame ${input.webId}`,
    TemplateName: input.template ?? 'Production Loss',
    StartTime: input.start.toISOString(),
    EndTime: input.end ? input.end.toISOString() : OPEN_SENTINEL,
    databaseWebId: input.databaseWebId ?? 'DB-HDPE',
    PrimaryReferencedElement: input.element ?? null,
    attributes: { ...(input.attributes ?? {}) },
  };
}

/**
 * `count` closed one-second frames, `stepSeconds` apart from `firstStart`, with a description
 * attribute each (T07: 1201 frames over three pages of 500).
 */
export function bulkFrames(input: {
  prefix: string;
  count: number;
  firstStart: Date;
  stepSeconds: number;
  template?: string;
}): SimFrame[] {
  return Array.from({ length: input.count }, (_, index) => {
    const start = new Date(
      input.firstStart.getTime() + index * input.stepSeconds * 1000,
    );
    return simFrame({
      webId: `${input.prefix}-${String(index).padStart(5, '0')}`,
      start,
      end: new Date(start.getTime() + 1000),
      template: input.template,
      attributes: { Description: `bulk ${index}` },
    });
  });
}

/** `minutes` before now. */
export function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60_000);
}
