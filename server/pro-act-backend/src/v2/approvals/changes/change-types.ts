/** How the client formats a value (plant digits, plant time zone, display currency). */
export type ChangeFormat =
  | 'text'
  | 'number'
  | 'quantity'
  | 'money'
  | 'instant'
  | 'date'
  | 'boolean'
  | 'duration';

/** A referenced record whose name the server resolves (the id is never shown). */
export type NameRef =
  | 'product'
  | 'unit'
  | 'asset'
  | 'user'
  | 'impact-code'
  | 'reason-code';

export type ChangeRow = Record<string, unknown>;

/** One field of a pending record: where its value is, how it reads and in which unit / currency. */
export interface FieldSpec {
  key: string;
  label: string;
  format?: ChangeFormat;
  /** unit of a quantity / rate, fixed or read from the record */
  unit?: string | ((row: ChangeRow) => string | null);
  /** currency of a money value, read from the record */
  currency?: (row: ChangeRow) => string | null;
  ref?: NameRef;
  /** a referenced record named after the label (`Loss line · availability · <reason name>`) */
  labelRef?: { ref: NameRef; id: string };
  /** money values of one figure in several reporting currencies share a group (the client shows one) */
  group?: string;
  /** shown for context on one side only; never counted as a change */
  informational?: boolean;
}

export interface ChangeField {
  key: string;
  label: string;
  /** the approved / effective predecessor's value; null without one */
  before: string | null;
  /** the pending value */
  after: string | null;
  unit: string | null;
  currency: string | null;
  format: ChangeFormat;
  group: string | null;
  changed: boolean;
}

/**
 * `diff`: the pending record against its approved / effective predecessor; `full`: no predecessor, the
 * pending content as it is; `compare`: two records side by side (a suggested duplicate against the kept stop).
 */
export type ChangeMode = 'diff' | 'full' | 'compare';

export interface ChangeSet {
  mode: ChangeMode;
  beforeLabel: string | null;
  afterLabel: string;
  fields: ChangeField[];
}

/** What a kind's loader read for one pending record. */
export interface ChangeSource {
  id: string;
  after: ChangeRow;
  before: ChangeRow | null;
  specs: FieldSpec[];
  mode?: ChangeMode;
  beforeLabel?: string;
  afterLabel?: string;
}
