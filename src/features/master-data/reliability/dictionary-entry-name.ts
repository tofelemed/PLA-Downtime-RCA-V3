/** A dictionary entry's name with "(pending)" for a pending entry, unless the name already says so (QA L9). */
export function dictionaryEntryName(entry: { name: string; isPending: boolean }): string {
  if (!entry.isPending || /\bpending\b/i.test(entry.name)) return entry.name;
  return `${entry.name} (pending)`;
}
