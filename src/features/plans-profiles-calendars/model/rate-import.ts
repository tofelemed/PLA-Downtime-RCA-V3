/** What the import form sends: the kind, the document reference and the CSV text. */
export interface RateImportInputs {
  kind?: string;
  externalId: string;
  csv: string;
}

const sameInputs = (a: RateImportInputs, b: RateImportInputs) => a.kind === b.kind && a.externalId === b.externalId && a.csv === b.csv;

/**
 * Why "Import" is unavailable (QA planning): the document reference and the file are both required, and a
 * file already sent is not sent again until the file, its reference or its kind changes (no double import).
 */
export function importBlockedReason(inputs: RateImportInputs, sent: RateImportInputs | null = null): string | null {
  if (!inputs.csv.trim() && !inputs.externalId.trim()) return 'Choose a file and enter its document reference first.';
  if (!inputs.csv.trim()) return 'Choose a file first (or paste its lines).';
  if (!inputs.externalId.trim()) return 'Enter the document reference first.';
  if (sent && sameInputs(inputs, sent)) return 'This file was sent. Change the file or its reference to import again.';
  return null;
}
