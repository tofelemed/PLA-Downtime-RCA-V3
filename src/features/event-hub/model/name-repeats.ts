const squash = (text: string): string => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/**
 * True when `secondary` adds nothing to `name`: the same letters and digits once case, spaces and
 * punctuation are ignored ("Extruder1" in "HDPE Extruder 1"). Empty text never counts as a repeat.
 */
export function nameRepeats(name: string, secondary: string | null | undefined): boolean {
  const extra = squash(secondary ?? '');
  return extra !== '' && squash(name).includes(extra);
}
