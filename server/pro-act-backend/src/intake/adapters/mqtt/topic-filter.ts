/**
 * MQTT topic filters (OASIS MQTT 5.0 §4.7): `+` matches exactly one level, `#` matches the rest of the
 * topic and may only be the whole last level. Used by config validation and the duplicate-feed guard.
 */
const MAX_FILTER_LENGTH = 65_535;

export function splitTopicLevels(filter: string): string[] {
  return filter.split('/');
}

/** The problem with a topic filter, or null when it is valid. */
export function validateTopicFilter(filter: unknown): string | null {
  if (typeof filter !== 'string' || filter.length === 0) {
    return 'must be a non-empty topic filter';
  }
  if (filter.length > MAX_FILTER_LENGTH) {
    return `must be at most ${MAX_FILTER_LENGTH} characters`;
  }
  if (filter.includes('\u0000')) return 'must not contain NUL characters';
  const levels = splitTopicLevels(filter);
  for (let index = 0; index < levels.length; index += 1) {
    const level = levels[index];
    if (level.includes('#')) {
      if (level !== '#') return '# must be a whole level';
      if (index !== levels.length - 1)
        return '# is only allowed as the last level';
    }
    if (level.includes('+') && level !== '+') return '+ must be a whole level';
  }
  return null;
}

/**
 * Whether two valid topic filters can both match one topic (level by level: a literal matches the same
 * literal or `+`; `#` on either side matches whatever remains, including nothing).
 */
export function topicFiltersOverlap(first: string, second: string): boolean {
  const a = splitTopicLevels(first);
  const b = splitTopicLevels(second);
  for (let index = 0; ; index += 1) {
    const levelA = a[index];
    const levelB = b[index];
    if (levelA === '#' || levelB === '#') return true;
    if (levelA === undefined && levelB === undefined) return true;
    if (levelA === undefined || levelB === undefined) return false;
    if (levelA !== '+' && levelB !== '+' && levelA !== levelB) return false;
  }
}

/** Whether a concrete topic (no wildcards) is matched by a valid filter. */
export function topicMatchesFilter(topic: string, filter: string): boolean {
  const levels = splitTopicLevels(topic);
  const pattern = splitTopicLevels(filter);
  for (let index = 0; ; index += 1) {
    const wanted = pattern[index];
    const actual = levels[index];
    if (wanted === '#') return true;
    if (wanted === undefined && actual === undefined) return true;
    if (wanted === undefined || actual === undefined) return false;
    if (wanted !== '+' && wanted !== actual) return false;
  }
}
