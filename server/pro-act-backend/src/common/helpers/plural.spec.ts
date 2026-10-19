import { plural } from './plural';

describe('plural', () => {
  it('one and many, never "(s)"', () => {
    expect(plural(1, 'stop', 'stops')).toBe('1 stop');
    expect(plural(0, 'stop', 'stops')).toBe('0 stops');
    expect(plural(4, 'uncoded stop', 'uncoded stops')).toBe('4 uncoded stops');
  });
});
