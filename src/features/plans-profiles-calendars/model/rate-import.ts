/** Why "Import" is unavailable (QA planning): the document reference and the file are both required. */
export function importBlockedReason(inputs: { externalId: string; csv: string }): string | null {
  if (!inputs.csv.trim() && !inputs.externalId.trim()) return 'Choose a file and enter its document reference first.';
  if (!inputs.csv.trim()) return 'Choose a file first (or paste its lines).';
  if (!inputs.externalId.trim()) return 'Enter the document reference first.';
  return null;
}
