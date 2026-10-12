import type { FiveWhyContent, FiveWhyLevel } from '@/api/v2/types/rca-analyses';
import { ANALYSIS_SETTINGS } from '../../../../model/analysis-settings';

const question = (answer: string) => `Why did "${answer.trim() || 'this'}" happen?`;

export const firstLevel = (): FiveWhyLevel => ({ level: 1, question: 'Why did this happen?', answer: '', justification: '' });

/** Adds the next "why", asked about the previous answer. */
export function addLevel(levels: readonly FiveWhyLevel[]): FiveWhyLevel[] {
  const last = levels[levels.length - 1];
  return [...levels, { level: levels.length + 1, question: question(last?.answer ?? ''), answer: '', justification: '' }];
}

/** Changes an answer and re-asks the next question about it. */
export function setAnswer(levels: readonly FiveWhyLevel[], index: number, answer: string): FiveWhyLevel[] {
  return levels.map((level, at) => {
    if (at === index) return { ...level, answer };
    if (at === index + 1) return { ...level, question: question(answer) };
    return level;
  });
}

export function setJustification(levels: readonly FiveWhyLevel[], index: number, justification: string): FiveWhyLevel[] {
  return levels.map((level, at) => (at === index ? { ...level, justification } : level));
}

/** Removes a level and renumbers the rest (the first level stays). */
export function removeLevel(levels: readonly FiveWhyLevel[], index: number): FiveWhyLevel[] {
  if (levels.length <= 1) return [...levels];
  return levels.filter((_, at) => at !== index).map((level, at) => ({ ...level, level: at + 1 }));
}

export interface FiveWhyCheck {
  label: string;
  done: boolean;
}

/** The completeness checklist of the method (minimum depth, answers, justifications, root cause). */
export function fiveWhyChecks(content: FiveWhyContent): FiveWhyCheck[] {
  const { minimumDepth, requireJustification } = ANALYSIS_SETTINGS.fiveWhy;
  const checks: FiveWhyCheck[] = [
    { label: 'Problem statement written', done: content.problem.trim() !== '' },
    { label: `At least ${minimumDepth} levels (${content.whyLevels.length} now)`, done: content.whyLevels.length >= minimumDepth },
    { label: 'Every level answered', done: content.whyLevels.every((level) => level.answer.trim() !== '') },
  ];
  if (requireJustification) {
    checks.push({ label: 'Every answer justified with evidence', done: content.whyLevels.every((level) => (level.justification ?? '').trim() !== '') });
  }
  checks.push({ label: 'Root cause identified', done: content.rootCause.trim() !== '' });
  return checks;
}

/** Plain-text report for the clipboard. */
export function fiveWhyReport(content: FiveWhyContent): string {
  const chain = content.whyLevels.map((level) =>
    [`Why ${level.level}: ${level.question}`, `Answer: ${level.answer}`, level.justification ? `Evidence: ${level.justification}` : ''].filter(Boolean).join('\n'),
  );
  return ['5-WHY ANALYSIS', '', `Problem: ${content.problem}`, '', ...chain, '', `Root cause: ${content.rootCause}`].join('\n');
}
