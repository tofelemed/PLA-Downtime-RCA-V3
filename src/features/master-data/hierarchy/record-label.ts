/** "code — name" of a unit or asset in the tree; just the name when the code repeats it (e.g. "EXT-Line2"). */
export function codeAndName(code: string, name: string): string {
  return code.trim().toLowerCase() === name.trim().toLowerCase() ? name : `${code} — ${name}`;
}
