import { describe, expect, it } from 'vitest';
import { actorText, resolvedActorText, systemActorText } from './actor-labels';

const UUID = 'd9800d1c-0000-4000-8000-000000000000';
const nameOf = (id: string) => (id === 'u1' ? 'Sara Ahmadi' : 'Former user');

describe('actor wording (owner finding 1)', () => {
  it('names people, never "a user" or an id', () => {
    expect(actorText({ kind: 'user', id: 'u1' }, nameOf)).toBe('Sara Ahmadi');
    expect(actorText({ id: 'u1' }, nameOf)).toBe('Sara Ahmadi');
    expect(actorText({ id: 'u9' }, nameOf)).toBe('Former user');
    expect(actorText({ id: 'u1', name: 'Server Name' }, nameOf)).toBe('Server Name');
  });

  it('says "System" with the source for engines, jobs and connectors', () => {
    expect(actorText({ kind: 'system', id: null }, nameOf)).toBe('System');
    expect(actorText({ kind: 'connector', id: null, source: 'PI AF Extruder 1' }, nameOf)).toBe('System (PI AF extruder 1)');
    expect(actorText({ kind: 'connector', id: null }, nameOf)).toBe('System (integration source)');
    expect(actorText({ id: null, source: 'accounting-worker' }, nameOf)).toBe('System (accounting recalculation)');
    expect(systemActorText('state-engine')).toBe('System (state engine)');
  });

  it('server-resolved pairs: name, else "Former user" for a user id, else System', () => {
    expect(resolvedActorText(UUID, 'Reza Karimi')).toBe('Reza Karimi');
    expect(resolvedActorText(UUID, null)).toBe('Former user');
    expect(resolvedActorText(null, null)).toBe('System');
    expect(resolvedActorText('system', null)).toBe('System');
  });
});
