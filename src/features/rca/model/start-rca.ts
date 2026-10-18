/**
 * "Start RCA" from where a loss is seen (loss line, loss event, Pareto reason, bad actor): the context
 * travels to `/rca/new` in the URL. `eventId` opens the event flow (new or existing case with the event's
 * evidence package); `lossLineId` adds a `loss_line` link once the case exists; the rest prefill a
 * standalone case. Nothing here decides anything — the server validates every id on the link.
 */
export interface StartRcaContext {
  eventId?: string | null;
  lossLineId?: string | null;
  unitId?: string | null;
  title?: string | null;
  description?: string | null;
}

const TITLE_MAX = 255;
const DESCRIPTION_MAX = 2000;

const clip = (value: string | null | undefined, max: number): string | null => {
  const text = value?.trim() ?? '';
  return text === '' ? null : text.slice(0, max);
};

export function startRcaHref(context: StartRcaContext): string {
  const params = new URLSearchParams();
  const entries: Array<[string, string | null]> = [
    ['eventId', clip(context.eventId, 64)],
    ['lossLineId', clip(context.lossLineId, 64)],
    ['unitId', clip(context.unitId, 64)],
    ['title', clip(context.title, TITLE_MAX)],
    ['description', clip(context.description, DESCRIPTION_MAX)],
  ];
  for (const [key, value] of entries) if (value) params.set(key, value);
  const query = params.toString();
  return query ? `/rca/new?${query}` : '/rca/new';
}

export function readStartRca(params: URLSearchParams): StartRcaContext {
  return {
    eventId: clip(params.get('eventId'), 64),
    lossLineId: clip(params.get('lossLineId'), 64),
    unitId: clip(params.get('unitId'), 64),
    title: clip(params.get('title'), TITLE_MAX),
    description: clip(params.get('description'), DESCRIPTION_MAX),
  };
}
