/**
 * Course wording in the closed HDPE-TRAIN investigation's typed texts (QA re-test round 3, owner go-ahead
 * 2026-10-19): "Training extruder…", "(fictional)" and "(guide: 600 comparable hours)". Each rule removes or
 * replaces only that wording; facts, figures and decisions stay as written. Pure, so the fixture test and the
 * repair script share it.
 */
import { COURSE_WORDING } from './finance-text-plan';

const RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\s*\((?:fictional|guide:[^)"]*)\)/gi, ''],
  [/\bFictional training evidence\.\s*/gi, ''],
  [/,\s*"training"(?=\s*\])/g, ''],
  [/\bTraining extruder\b/g, 'Extruder'],
  [/\btraining extruder\b/g, 'extruder'],
];

/** The text without the course wording (unchanged when there is none). */
export function plainCaseText(text: string): string {
  return RULES.reduce(
    (current, [pattern, by]) => current.replace(pattern, by),
    text,
  );
}

/** Course or "fictional" wording the rules leave behind, for review by hand. */
export const LEFTOVER_WORDING = new RegExp(
  `${COURSE_WORDING.source}|fictional`,
  'i',
);

export interface CellChange {
  table: string;
  column: string;
  id: string;
  before: string;
  after: string;
}

/** The changes of one row's text cells (`cells`: column → stored text, JSON as text). */
export function rowChanges(
  table: string,
  id: string,
  cells: Readonly<Record<string, string | null>>,
): CellChange[] {
  return Object.entries(cells).flatMap(([column, before]) => {
    if (!before) return [];
    const after = plainCaseText(before);
    return after === before ? [] : [{ table, column, id, before, after }];
  });
}
