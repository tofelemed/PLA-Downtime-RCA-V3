import { emptyHealth, HealthTracker } from './subscription-health';

describe('HealthTracker (plan 1.8 step 3, design §8)', () => {
  it('starts disconnected with zero counters and no parking', () => {
    expect(new HealthTracker().snapshot()).toEqual(emptyHealth());
  });

  it.each([
    ['accepted', 'accepted'],
    ['revision', 'accepted'],
    ['replayed', 'accepted'],
    ['duplicate', 'duplicate'],
    ['duplicate_content', 'duplicate'],
    ['stale', 'stale'],
    ['conflict', 'conflict'],
    ['invalid', 'quarantined'],
    ['quarantined', 'quarantined'],
  ] as const)('counts a %s persist under %s', (outcome, counter) => {
    const tracker = new HealthTracker();
    tracker.received(new Date('2026-10-11T06:00:00Z'));
    tracker.persisted(outcome, null);
    const { counters, inflight, lastPersistAt } = tracker.snapshot();
    expect(counters.received).toBe(1);
    expect(counters[counter]).toBe(1);
    expect(inflight).toBe(0);
    expect(lastPersistAt).not.toBeNull();
  });

  it('keeps the newest observation time until the heartbeat takes it', () => {
    const tracker = new HealthTracker();
    tracker.persisted('accepted', new Date('2026-10-11T06:00:00Z'));
    tracker.persisted('revision', new Date('2026-10-11T06:05:00Z'));
    tracker.persisted('stale', new Date('2026-10-11T05:00:00Z'));
    expect(tracker.takeObservation()).toEqual(new Date('2026-10-11T06:05:00Z'));
    expect(tracker.takeObservation()).toBeNull();
  });

  it('shows a persist failure until the next successful persist (trap T8)', () => {
    const tracker = new HealthTracker();
    tracker.received(new Date());
    tracker.persistFailed('connection refused');
    expect(tracker.snapshot()).toMatchObject({
      inflight: 0,
      persistFailed: { error: 'connection refused' },
    });
    tracker.persisted('accepted', null);
    expect(tracker.snapshot().persistFailed).toBeNull();
  });

  it('records connection facts, reconnects and parking, and seeds the filters of a kept session', () => {
    const tracker = new HealthTracker();
    tracker.seed({ subscribedTopics: ['a/#', 7, 'b'], other: 'ignored' });
    expect(tracker.snapshot().subscribedTopics).toEqual(['a/#', 'b']);
    tracker.connecting('proact-1', 3);
    tracker.connected(true);
    tracker.subscribed(['x/+']);
    tracker.reconnecting();
    tracker.disconnected('Keepalive timeout');
    tracker.parked('duplicate_feed', 'overlaps "Line 1"');
    expect(tracker.snapshot()).toMatchObject({
      connected: false,
      connectionError: 'Keepalive timeout',
      reconnects: 1,
      sessionPresent: true,
      effectiveClientId: 'proact-1',
      configVersion: 3,
      subscribedTopics: ['x/+'],
      parkedReason: 'duplicate_feed',
      parkedDetail: 'overlaps "Line 1"',
    });
    tracker.unparked();
    expect(tracker.snapshot().parkedReason).toBeNull();
  });

  it('snapshots are copies: mutating one never changes the tracker', () => {
    const tracker = new HealthTracker();
    const snapshot = tracker.snapshot();
    snapshot.counters.received = 99;
    snapshot.subscribedTopics.push('z');
    expect(tracker.snapshot().counters.received).toBe(0);
    expect(tracker.snapshot().subscribedTopics).toEqual([]);
  });
});
