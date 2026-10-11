import { classifyConnectError, connackReasonName } from './mqtt-connack';

const withCode = (message: string, code: string | number): Error =>
  Object.assign(new Error(message), { code });

describe('CONNACK reason codes and connection error classification', () => {
  const context = { protocolVersion: 5 as const, host: 'broker.plant.local' };

  it('names MQTT 5 reason codes and 3.1.1 return codes', () => {
    expect(connackReasonName(5, 0x86)).toBe('BadUserNameOrPassword');
    expect(connackReasonName(5, 0x87)).toBe('NotAuthorized');
    expect(connackReasonName(4, 4)).toBe('BadUserNameOrPassword');
    expect(connackReasonName(4, 5)).toBe('NotAuthorized');
    expect(connackReasonName(5, 0xee)).toBe('0xee');
  });

  it('maps a refused CONNACK to a message and retryability', () => {
    expect(
      classifyConnectError(
        withCode('Connection refused: Bad username or password', 0x86),
        context,
      ),
    ).toMatchObject({
      kind: 'refused',
      message: 'Broker refused connection: BadUserNameOrPassword',
      retryable: false,
      reasonCode: 0x86,
    });
    expect(
      classifyConnectError(withCode('refused', 0x88), context),
    ).toMatchObject({
      kind: 'refused',
      reasonName: 'ServerUnavailable',
      retryable: true,
    });
    expect(
      classifyConnectError(withCode('refused', 4), {
        ...context,
        protocolVersion: 4,
      }),
    ).toMatchObject({ reasonName: 'BadUserNameOrPassword', retryable: false });
  });

  it('turns TLS failures into a SAN / servername hint and socket errors into unreachable', () => {
    const tls = classifyConnectError(
      withCode(
        'Hostname/IP does not match certificate',
        'ERR_TLS_CERT_ALTNAME_INVALID',
      ),
      { ...context, servername: 'mosquitto' },
    );
    expect(tls).toMatchObject({
      kind: 'tls',
      retryable: false,
      errorCode: 'ERR_TLS_CERT_ALTNAME_INVALID',
    });
    expect(tls.message).toContain('"mosquitto"');
    expect(tls.message).toContain('tls.servername');
    expect(
      classifyConnectError(
        withCode('self signed certificate', 'DEPTH_ZERO_SELF_SIGNED_CERT'),
        context,
      ).message,
    ).toContain('"broker.plant.local"');
    expect(
      classifyConnectError(
        withCode('connect ECONNREFUSED 127.0.0.1:1', 'ECONNREFUSED'),
        context,
      ),
    ).toMatchObject({
      kind: 'unreachable',
      retryable: true,
      message: 'Broker unreachable: connect ECONNREFUSED 127.0.0.1:1',
    });
    expect(
      classifyConnectError(new Error('connack timeout'), context),
    ).toMatchObject({ kind: 'timeout' });
    expect(classifyConnectError('boom', context)).toMatchObject({
      kind: 'error',
      message: 'Connection failed: boom',
    });
  });
});
