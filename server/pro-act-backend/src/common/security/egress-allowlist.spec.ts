import { isEgressAllowed } from './egress-allowlist';

/** Plan 3.11: outbound connector calls only reach listed hosts once the allowlist is set. */
describe('connector egress allowlist', () => {
  const env = {
    CONNECTOR_EGRESS_ALLOWLIST:
      'pi.plant.local, *.corp.example, historian.lan:8443',
  };

  it('allows everything while unset (development)', () => {
    expect(isEgressAllowed('https://anything.example/piwebapi', {})).toBe(true);
  });

  it('matches exact hosts, subdomain wildcards and ports', () => {
    expect(isEgressAllowed('https://pi.plant.local/piwebapi', env)).toBe(true);
    expect(isEgressAllowed('https://PI.PLANT.LOCAL:443/piwebapi', env)).toBe(
      true,
    );
    expect(isEgressAllowed('https://af.corp.example/piwebapi', env)).toBe(true);
    expect(isEgressAllowed('https://corp.example/piwebapi', env)).toBe(false);
    expect(isEgressAllowed('https://historian.lan:8443/x', env)).toBe(true);
    expect(isEgressAllowed('https://historian.lan/x', env)).toBe(false);
  });

  it('refuses other hosts, look-alikes and malformed URLs', () => {
    expect(
      isEgressAllowed('https://169.254.169.254/latest/meta-data', env),
    ).toBe(false);
    expect(isEgressAllowed('https://pi.plant.local.evil.example/x', env)).toBe(
      false,
    );
    expect(isEgressAllowed('not a url', env)).toBe(false);
  });
});
