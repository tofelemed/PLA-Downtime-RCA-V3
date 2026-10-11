import {
  decodeQuality,
  QualityProtocol,
  QualityStatus,
  toEnvelopeQuality,
} from './quality-decoder';

type Row = [QualityProtocol, unknown, QualityStatus, string[]];

/** protocol, raw value, expected status, expected source flags */
const TABLE: Row[] = [
  // contract §3.4: PI value flags
  ['PI', { good: true, questionable: false, substituted: false }, 'good', []],
  ['PI', { good: true }, 'good', []],
  ['PI', { good: true, substituted: true }, 'good', ['substituted']],
  ['PI', { good: true, annotated: true }, 'good', ['annotated']],
  ['PI', { good: true, questionable: true }, 'uncertain', ['questionable']],
  ['PI', { good: false }, 'bad', []],
  ['PI', { good: false, questionable: true }, 'bad', ['questionable']],
  ['PI', { questionable: false }, 'uncertain', []],
  ['PI', {}, 'uncertain', []],
  ['PI', 'GOOD', 'good', []],
  ['PI', 42, 'uncertain', []],
  ['PI', undefined, 'missing', []],
  ['PI', null, 'missing', []],
  // string tokens
  ['STRING_ENUM', 'GOOD', 'good', []],
  ['STRING_ENUM', 'good', 'good', []],
  ['STRING_ENUM', ' ok ', 'good', []],
  ['STRING_ENUM', 'UNCERTAIN', 'uncertain', ['uncertain']],
  ['STRING_ENUM', 'Questionable', 'uncertain', ['questionable']],
  ['STRING_ENUM', 'STALE', 'uncertain', ['stale']],
  ['STRING_ENUM', 'UNKNOWN', 'uncertain', ['unknown']],
  ['STRING_ENUM', 'BAD', 'bad', ['bad']],
  ['STRING_ENUM', 'ERROR', 'bad', ['error']],
  ['STRING_ENUM', 'MISSING', 'missing', ['missing']],
  ['STRING_ENUM', 'NO_DATA', 'missing', ['no_data']],
  ['STRING_ENUM', 'EXCELLENT', 'uncertain', []],
  ['STRING_ENUM', 7, 'uncertain', []],
  ['STRING_ENUM', undefined, 'missing', []],
  // OPC DA quality byte: bits 7-6
  ['OPC_DA', 0xc0, 'good', []],
  ['OPC_DA', 0xc3, 'good', []],
  ['OPC_DA', 192, 'good', []],
  ['OPC_DA', 0x40, 'uncertain', ['opc_da:0x40']],
  ['OPC_DA', 0x00, 'bad', ['opc_da:0x0']],
  ['OPC_DA', 0x04, 'bad', ['opc_da:0x4']],
  ['OPC_DA', 0x80, 'uncertain', ['opc_da:0x80']],
  ['OPC_DA', '0xC0', 'good', []],
  ['OPC_DA', 'good', 'uncertain', []],
  ['OPC_DA', -1, 'uncertain', []],
  ['OPC_DA', undefined, 'missing', []],
  // OPC UA StatusCode severity in the two top bits
  ['OPC_UA', 0, 'good', []],
  ['OPC_UA', 0x00000400, 'good', []],
  ['OPC_UA', 0x40000000, 'uncertain', ['opc_ua:0x40000000']],
  ['OPC_UA', 0x406c0000, 'uncertain', ['opc_ua:0x406c0000']],
  ['OPC_UA', 0x80000000, 'bad', ['opc_ua:0x80000000']],
  ['OPC_UA', 0xc0000000, 'bad', ['opc_ua:0xc0000000']],
  ['OPC_UA', '0x80340000', 'bad', ['opc_ua:0x80340000']],
  ['OPC_UA', 1.5, 'uncertain', []],
  ['OPC_UA', undefined, 'missing', []],
  // Sparkplug B quality property
  ['SPARKPLUG', 192, 'good', []],
  ['SPARKPLUG', 0, 'bad', ['sparkplug:0']],
  ['SPARKPLUG', 500, 'uncertain', ['sparkplug:500']],
  ['SPARKPLUG', { value: 192 }, 'good', []],
  ['SPARKPLUG', 7, 'uncertain', []],
  ['SPARKPLUG', undefined, 'missing', []],
  // a source declared without a quality concept
  ['NONE', undefined, 'good', []],
  ['NONE', 'BAD', 'good', []],
];

describe('quality decoder (design §4.2 stage 8, contract §3.4)', () => {
  it.each(TABLE)('%s %p → %s', (protocol, raw, status, flags) => {
    const decoded = decodeQuality(protocol, raw);
    expect(decoded.status).toBe(status);
    expect(decoded.sourceFlags).toEqual(flags);
  });

  it('names the reason when a value is unrecognised, never good', () => {
    const decoded = decodeQuality('STRING_ENUM', 'EXCELLENT');
    expect(decoded.reason).toContain('unrecognised quality value "EXCELLENT"');
    expect(decodeQuality('PI', {}).reason).toContain('no good indicator');
    expect(decodeQuality('PI', undefined).reason).toContain('no quality value');
  });

  it('builds the envelope quality with the time flags and the degraded marker', () => {
    const decoded = decodeQuality('PI', { good: true, questionable: true });
    expect(
      toEnvelopeQuality(decoded, { degraded: true, flags: ['stale'] }),
    ).toEqual({
      status: 'uncertain',
      sourceFlags: ['questionable', 'stale'],
      degraded: true,
    });
    expect(
      toEnvelopeQuality(decodeQuality('PI', { good: true }), {
        degraded: false,
        flags: [],
      }),
    ).toEqual({ status: 'good', degraded: false });
    expect(
      toEnvelopeQuality(decodeQuality('PI', undefined), {
        degraded: false,
        flags: [],
      }),
    ).toEqual({
      status: 'missing',
      reason: 'no quality value in the message',
      degraded: false,
    });
  });
});
