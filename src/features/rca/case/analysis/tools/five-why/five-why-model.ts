import type { FiveWhyContent, FiveWhyLevel } from '@/api/v2/types/rca-analyses';

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

/**
 * The completeness checklist the server's investigation gate applies (SME CA6): answers, evidence for every
 * answer and a root cause. The number of levels is not a check — five is guidance (`depthGuidance`).
 */
export function fiveWhyChecks(content: FiveWhyContent): FiveWhyCheck[] {
  return [
    { label: 'Problem statement written', done: content.problem.trim() !== '' },
    { label: 'Every level answered', done: content.whyLevels.every((level) => level.answer.trim() !== '') },
    {
      label: 'Every answer backed by evidence',
      done: content.whyLevels.every((level) => (level.justification ?? '').trim() !== ''),
    },
    { label: 'System-level root cause written', done: content.rootCause.trim() !== '' },
  ];
}

/** CA6 guidance on depth: the server's guideline (e.g. 5) as a prompt, never a gate. */
export function depthGuidance(levels: number, guideline: number | null): string {
  const base = 'Stop when the evidence supports the chain to a system cause you can act on; do not invent answers.';
  if (!guideline) return `${levels} level(s). ${base}`;
  return `${levels} of the ${guideline} levels of the guideline. ${base}`;
}

/** Plain-text report for the clipboard. */
export function fiveWhyReport(content: FiveWhyContent): string {
  const chain = content.whyLevels.map((level) =>
    [`Why ${level.level}: ${level.question}`, `Answer: ${level.answer}`, level.justification ? `Evidence: ${level.justification}` : ''].filter(Boolean).join('\n'),
  );
  return ['5-WHY ANALYSIS', '', `Problem: ${content.problem}`, '', ...chain, '', `Root cause: ${content.rootCause}`].join('\n');
}
