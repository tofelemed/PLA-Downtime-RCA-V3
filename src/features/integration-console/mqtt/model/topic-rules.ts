/**
 * MQTT topic filter and topic template rules, mirrored from the backend (`topic-filter.ts`,
 * `payload-profile.ts`): `+` matches one whole level, `#` only the whole last level; a template is
 * literal levels and `{capture}` levels.
 */
const MAX_FILTER_LENGTH = 65_535;
const CAPTURE = /^\{([a-z][A-Za-z0-9_]*)\}$/;

/** The problem with a topic filter, or null when it is valid. */
export function validateTopicFilter(filter: string): string | null {
  if (filter.length === 0) return 'must be a non-empty topic filter';
  if (filter.length > MAX_FILTER_LENGTH) return `must be at most ${MAX_FILTER_LENGTH} characters`;
  if (filter.includes('\u0000')) return 'must not contain NUL characters';
  const levels = filter.split('/');
  for (const [index, level] of levels.entries()) {
    if (level.includes('#')) {
      if (level !== '#') return '# must be a whole level';
      if (index !== levels.length - 1) return '# is only allowed as the last level';
    }
    if (level.includes('+') && level !== '+') return '+ must be a whole level';
  }
  return null;
}

/** Whether two valid filters can both match one topic (level by level, `+` / `#` aware). */
export function topicFiltersOverlap(first: string, second: string): boolean {
  const a = first.split('/');
  const b = second.split('/');
  for (let index = 0; ; index += 1) {
    const levelA = a[index];
    const levelB = b[index];
    if (levelA === '#' || levelB === '#') return true;
    if (levelA === undefined && levelB === undefined) return true;
    if (levelA === undefined || levelB === undefined) return false;
    if (levelA !== '+' && levelB !== '+' && levelA !== levelB) return false;
  }
}

/** Capture names and the equivalent filter of a topic template, or the problem with it. */
export function parseTopicTemplate(template: string): { captures: string[]; filter: string } | string {
  if (template.length === 0) return 'must be a non-empty topic template';
  const captures: string[] = [];
  const levels: string[] = [];
  for (const level of template.split('/')) {
    const capture = CAPTURE.exec(level);
    if (capture) {
      if (captures.includes(capture[1])) return `captures {${capture[1]}} more than once`;
      captures.push(capture[1]);
      levels.push('+');
      continue;
    }
    if (/[+#{}]/.test(level) || level.length === 0) return `level "${level}" must be a literal or a {capture}`;
    levels.push(level);
  }
  return { captures, filter: levels.join('/') };
}
