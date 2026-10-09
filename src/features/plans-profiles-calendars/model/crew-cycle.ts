/** Crew rotation cycle as text: `A,A,B,-` ↔ `['A', 'A', 'B', null]` (`-` or empty = day off). */
export function cycleOf(text: string): Array<string | null> {
  return text.split(',').map((entry) => {
    const name = entry.trim();
    return name === '' || name === '-' ? null : name;
  });
}

export function cycleText(cycle: ReadonlyArray<string | null>): string {
  return cycle.map((entry) => entry ?? '-').join(',');
}
