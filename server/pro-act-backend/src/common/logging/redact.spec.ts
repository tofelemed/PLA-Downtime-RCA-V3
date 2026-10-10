import { redactSecrets } from './redact';

/** Plan 3.11: no credential reaches a log line. */
describe('redactSecrets', () => {
  const jwt =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

  it.each([
    [`Authorization: Bearer ${jwt}`, jwt],
    [`GET /api/x?token=${jwt}`, jwt],
    ['postgres://proact:Sup3rS3cret@db:5432/proact', 'Sup3rS3cret'],
    ['{"password":"hunter2","user":"a"}', 'hunter2'],
    ['refresh_token=abc.def.ghi&x=1', 'abc.def.ghi'],
    ['stored enc:v2:k1:aGVsbG8=:dGFn:Y2lwaGVy', 'aGVsbG8='],
    ['apiKey=AKIA1234567890', 'AKIA1234567890'],
  ])('masks %s', (line, secret) => {
    expect(redactSecrets(line)).not.toContain(secret);
  });

  it('leaves ordinary log lines alone', () => {
    const line =
      'POST /api/v2/production-events/123/close -> 409 EVENT_NOT_OPEN [c-1]';
    expect(redactSecrets(line)).toBe(line);
  });
});
