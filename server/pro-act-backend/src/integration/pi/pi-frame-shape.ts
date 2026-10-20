import type { PiEventFrame } from '../pi-frame-ingest.service';

/** `…/elements/{webId}` at the end of a PI Web API link. */
const ELEMENT_LINK = /\/elements\/([^/?#]+)\/?(?:[?#].*)?$/i;

/**
 * The frame with its primary AF element as `PrimaryReferencedElement`, whatever shape PI delivered:
 * an embedded object (older simulators and fixtures), `PrimaryReferencedElementWebId`, the
 * `Links.PrimaryReferencedElement` URL a standard PI Web API event frame carries, or — when PI names
 * exactly one referenced element — that element (D02: confirm the shape on the installation). A frame
 * with none of these keeps no element and is placed by its own WebId / path.
 */
export function normalizeFrame(frame: PiEventFrame): PiEventFrame {
  if (frame.PrimaryReferencedElement?.WebId) return frame;
  const webId = primaryWebIdOf(frame);
  if (!webId) return frame;
  return {
    ...frame,
    PrimaryReferencedElement: {
      WebId: webId,
      Path: frame.PrimaryReferencedElement?.Path ?? null,
    },
  };
}

function primaryWebIdOf(frame: PiEventFrame): string | null {
  const shaped = frame as PiEventFrame & {
    PrimaryReferencedElementWebId?: unknown;
    Links?: { PrimaryReferencedElement?: unknown } | null;
  };
  if (typeof shaped.PrimaryReferencedElementWebId === 'string') {
    return shaped.PrimaryReferencedElementWebId || null;
  }
  const link = shaped.Links?.PrimaryReferencedElement;
  const linked = typeof link === 'string' ? ELEMENT_LINK.exec(link) : null;
  if (linked) return decodeURIComponent(linked[1]);
  const refs = frame.RefElementWebIds ?? [];
  return refs.length === 1 ? refs[0] : null;
}

/** The frame with the primary element's AF path filled in (looked up by WebId when PI sent none). */
export function withElementPath(
  frame: PiEventFrame,
  path: string | null,
): PiEventFrame {
  const primary = frame.PrimaryReferencedElement;
  if (!path || !primary?.WebId || primary.Path) return frame;
  return { ...frame, PrimaryReferencedElement: { ...primary, Path: path } };
}
