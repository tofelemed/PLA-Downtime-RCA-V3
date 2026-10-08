import {
  connectionBaseUrl,
  isTlsVerificationDisabled,
  resolveProxyUrl,
  sameOrigin,
} from './pi-proxy-policy';

const CONNECTION = 'https://pi.example.local:7443/piwebapi/';

describe('pi-proxy policy', () => {
  describe('connectionBaseUrl', () => {
    it('normalises to <origin>/piwebapi', () => {
      expect(connectionBaseUrl(CONNECTION)?.toString()).toBe(
        'https://pi.example.local:7443/piwebapi',
      );
      expect(
        connectionBaseUrl('https://pi.example.local:7443')?.toString(),
      ).toBe('https://pi.example.local:7443/piwebapi');
      expect(
        connectionBaseUrl(
          'http://user:pw@pi.example.local/PIWebAPI?x=1',
        )?.toString(),
      ).toBe('http://pi.example.local/PIWebAPI');
    });

    it('rejects non-http schemes and garbage', () => {
      expect(connectionBaseUrl('ftp://pi.example.local')).toBeNull();
      expect(connectionBaseUrl('not a url')).toBeNull();
    });
  });

  describe('resolveProxyUrl', () => {
    it.each([
      ['/assetservers', 'https://pi.example.local:7443/piwebapi/assetservers'],
      [
        'assetdatabases/F1RD?selectedFields=Items',
        'https://pi.example.local:7443/piwebapi/assetdatabases/F1RD?selectedFields=Items',
      ],
      [
        '/elements/F1Em/attributes',
        'https://pi.example.local:7443/piwebapi/elements/F1Em/attributes',
      ],
      [
        '/eventframes/search',
        'https://pi.example.local:7443/piwebapi/eventframes/search',
      ],
      [
        '/streams/F1DP/recorded',
        'https://pi.example.local:7443/piwebapi/streams/F1DP/recorded',
      ],
      [
        '/streamsets/recorded',
        'https://pi.example.local:7443/piwebapi/streamsets/recorded',
      ],
      [
        '/attributes/F1Ab',
        'https://pi.example.local:7443/piwebapi/attributes/F1Ab',
      ],
      ['/batch', 'https://pi.example.local:7443/piwebapi/batch'],
      ['/ASSETSERVERS', 'https://pi.example.local:7443/piwebapi/ASSETSERVERS'],
    ])('accepts allowlisted path %s', (path, expected) => {
      expect(resolveProxyUrl(CONNECTION, path)?.url).toBe(expected);
    });

    it.each([
      ['other PI controller', '/system/versions'],
      ['prefix spoofing', '/assetserversX'],
      ['traversal out of the allowlist', '/assetservers/../../system/versions'],
      ['encoded traversal', '/assetservers/%2e%2e/%2e%2e/system'],
      [
        'protocol-relative host switch',
        '//evil.example.com/piwebapi/assetservers',
      ],
      [
        'absolute foreign url',
        'https://evil.example.com/piwebapi/assetservers',
      ],
      ['backslash tricks', '\\\\evil.example.com\\piwebapi\\assetservers'],
      ['empty', ''],
    ])('rejects %s', (_label, path) => {
      expect(resolveProxyUrl(CONNECTION, path)).toBeNull();
    });

    it('rejects when the connection itself is not http(s)', () => {
      expect(resolveProxyUrl('file:///etc/passwd', '/assetservers')).toBeNull();
    });
  });

  describe('sameOrigin', () => {
    it('compares scheme, host and port case-insensitively', () => {
      expect(
        sameOrigin(
          'https://PI.example.local:7443/piwebapi',
          'https://pi.example.local:7443',
        ),
      ).toBe(true);
      expect(
        sameOrigin(
          'https://pi.example.local:7443',
          'https://pi.example.local:8443',
        ),
      ).toBe(false);
      expect(
        sameOrigin('http://pi.example.local', 'https://pi.example.local'),
      ).toBe(false);
      expect(sameOrigin('nonsense', 'https://pi.example.local')).toBe(false);
    });
  });

  describe('isTlsVerificationDisabled', () => {
    it('requires an explicit opt-out flag in the connection config', () => {
      expect(
        isTlsVerificationDisabled(
          JSON.stringify({ insecureSkipTlsVerify: true }),
        ),
      ).toBe(true);
      expect(
        isTlsVerificationDisabled(
          JSON.stringify({ insecureSkipTlsVerify: 'yes' }),
        ),
      ).toBe(false);
      expect(isTlsVerificationDisabled('{}')).toBe(false);
      expect(isTlsVerificationDisabled('not json')).toBe(false);
      expect(isTlsVerificationDisabled(undefined)).toBe(false);
    });
  });
});
