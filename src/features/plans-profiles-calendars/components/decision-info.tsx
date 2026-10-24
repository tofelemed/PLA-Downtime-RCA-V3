import type { DecisionNote } from '../model/decision-notes';
import { InfoMark } from './info-mark';

/** The ⓘ beside the page title with a tab's decision note (replaces the banner; the test id stays). */
export function DecisionInfo({ note }: { note: DecisionNote }) {
  return <InfoMark label={note.label} text={note.text} testId="decision-banner" data={{ 'data-decision': note.id }} />;
}
