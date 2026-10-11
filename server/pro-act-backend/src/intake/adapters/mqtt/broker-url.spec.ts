import { parseBrokerUrl } from './broker-url';

describe('parseBrokerUrl (plan 1.8 §3, one parser for validation and runtime)', () => {
  it.each([
    [
      'mqtt://broker.plant.local',
      'mqtt://broker.plant.local:1883',
      1883,
      false,
    ],
    [
      'mqtts://broker.plant.local',
      'mqtts://broker.plant.local:8883',
      8883,
      true,
    ],
    [
      'mqtts://BROKER.Plant.Local:8884',
      'mqtts://broker.plant.local:8884',
      8884,
      true,
    ],
    ['mqtt://192.168.190.91:1884', 'mqtt://192.168.190.91:1884', 1884, false],
    ['mqtt://localhost', 'mqtt://localhost:1883', 1883, false],
    ['mqtts://[2001:db8::1]:8883', 'mqtts://[2001:db8::1]:8883', 8883, true],
    ['mqtt://[::1]', 'mqtt://[::1]:1883', 1883, false],
    [' mqtt://host ', 'mqtt://host:1883', 1883, false],
  ])('parses %s', (input, normalized, port, secure) => {
    expect(parseBrokerUrl(input)).toMatchObject({ normalized, port, secure });
  });

  it.each([
    'tcp://broker',
    'ws://broker',
    'http://broker',
    'mqtt://broker/',
    'mqtt://broker/path',
    'mqtt://broker?x=1',
    'mqtt://user:pw@broker',
    'mqtt://broker:0',
    'mqtt://broker:70000',
    'mqtt://broker:abc',
    'mqtt://-bad.host',
    'mqtt://[not-ipv6]',
    'mqtt://2001:db8::1',
    'mqtt://',
    '',
    42,
    null,
    undefined,
  ])('refuses %p', (input) => {
    expect(parseBrokerUrl(input)).toBeNull();
  });
});
