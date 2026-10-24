const squash = (text: string): string => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/**
 * True when a unit code adds nothing to the unit name: the same letters and digits once case, spaces and
 * punctuation are ignored, either the whole name or its ending ("Extruder1" for "HDPE Extruder 1", but not
 * for "Extruder 11"). A purely numeric code ("1", "10") always adds something; empty text never repeats.
 */
export function nameRepeats(name: string, code: string | null | undefined): boolean {
  const extra = squash(code ?? '');
  if (extra === '' || /^\p{N}+$/u.test(extra)) return false;
  const full = squash(name);
  return full === extra || full.endsWith(extra);
}

/** True when two names are the same once case, spaces and punctuation are ignored (an asset named like its unit). */
export function sameName(a: string, b: string | null | undefined): boolean {
  const other = squash(b ?? '');
  return other !== '' && squash(a) === other;
}
