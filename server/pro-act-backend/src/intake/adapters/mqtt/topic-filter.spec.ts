import {
  topicFiltersOverlap,
  topicMatchesFilter,
  validateTopicFilter,
} from './topic-filter';

describe('topic filters (MQTT 5.0 §4.7)', () => {
  it.each([
    'a',
    'a/b',
    '+',
    '#',
    'a/+/c',
    'a/#',
    '+/#',
    'a//b',
    '$SYS/#',
    '/a',
  ])('accepts %s', (filter) => {
    expect(validateTopicFilter(filter)).toBeNull();
  });

  it.each([
    ['', 'non-empty'],
    ['a/#/b', 'last level'],
    ['a#', 'whole level'],
    ['#/a', 'last level'],
    ['a+', 'whole level'],
    ['+a/b', 'whole level'],
    ['a/b\u0000', 'NUL'],
    [42, 'non-empty'],
    ['x'.repeat(65_536), 'at most'],
  ])('refuses %p', (filter, fragment) => {
    expect(validateTopicFilter(filter)).toContain(fragment);
  });

  describe('overlap (level by level, + one level, # the rest)', () => {
    it.each([
      ['a/b', 'a/b'],
      ['a/+', 'a/b'],
      ['+/b', 'a/+'],
      ['a/#', 'a/b/c'],
      ['a/#', 'a'],
      ['#', 'x/y/z'],
      ['a/+/#', 'a/b'],
      ['proact/v1/+/+/+/+/events', 'proact/v1/HDPE/#'],
    ])('%s overlaps %s (both ways)', (first, second) => {
      expect(topicFiltersOverlap(first, second)).toBe(true);
      expect(topicFiltersOverlap(second, first)).toBe(true);
    });

    it.each([
      ['a/b', 'a/c'],
      ['a/b', 'a/b/c'],
      ['a/+', 'a/b/c'],
      ['a/#', 'b/#'],
      ['+/x', '+/y'],
      ['a', 'a/b'],
      ['proact/v1/+/+/+/+/events', 'proact/v1/+/+/+/+/state'],
      ['proact/v1/+/+/+/+/events', 'proact/v2/#'],
    ])('%s does not overlap %s (both ways)', (first, second) => {
      expect(topicFiltersOverlap(first, second)).toBe(false);
      expect(topicFiltersOverlap(second, first)).toBe(false);
    });
  });

  it('matches concrete topics against filters', () => {
    expect(topicMatchesFilter('a/b/c', 'a/+/c')).toBe(true);
    expect(topicMatchesFilter('a/b/c', 'a/#')).toBe(true);
    expect(topicMatchesFilter('a', 'a/#')).toBe(true);
    expect(topicMatchesFilter('a/b/c', 'a/+')).toBe(false);
    expect(topicMatchesFilter('a/b', 'a/b/c')).toBe(false);
    expect(topicMatchesFilter('x/b', 'a/b')).toBe(false);
  });
});
