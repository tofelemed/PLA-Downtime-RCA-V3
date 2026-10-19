/**
 * Notes the system writes on a revision, in words (QA audit F4: the History tab showed `failure_validation`,
 * `verification`, `created`; docs/GLOSSARY.md: an RCA case is an "investigation"). A note a person typed
 * (the change reason) is shown as typed.
 */
const SYSTEM_NOTES: Readonly<Record<string, string>> = {
  created: 'Created',
  verification: 'Coding verified',
  failure_validation: 'Failure detail validated',
  'RCA case linked': 'Investigation linked',
  'RCA case closed': 'Investigation closed',
};

const BULK_PREFIX = 'bulk code: ';

export function revisionNoteText(note: string): string {
  const system = SYSTEM_NOTES[note];
  if (system) return system;
  if (note.startsWith(BULK_PREFIX)) return `Bulk code: ${note.slice(BULK_PREFIX.length)}`;
  return note;
}
