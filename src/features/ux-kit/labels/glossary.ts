/**
 * Canonical user-facing nouns (docs/GLOSSARY.md, UX audit H-12). Screens use these words; API fields and
 * enum values keep their own names (`residual`, `rcaId`, `tenant`). Stop / event: `eventNoun` in
 * `event-labels.ts`.
 */
export const GLOSSARY = {
  /** the reconciliation residual (gap − attributed − tolerance adjustment); "Gap" is target − actual */
  residual: 'Unaccounted',
  /** an RCA case; the module keeps the name "RCA" */
  investigation: 'Investigation',
  investigations: 'Investigations',
  /** a record or grant without a unit limit (never "Tenant-wide") */
  wholePlant: 'Whole plant',
} as const;
