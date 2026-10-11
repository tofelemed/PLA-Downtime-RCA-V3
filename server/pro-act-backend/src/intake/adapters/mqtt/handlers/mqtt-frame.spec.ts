import { CanonicalEnvelope } from '../../../envelope/canonical-envelope';
import { decodeMqttMessage } from '../profiles';
import { examplePacket } from '../mqtt-decode.example';
import { mqttFrameOf } from './mqtt-frame';

function decode(payload: Record<string, unknown>): CanonicalEnvelope {
  const result = decodeMqttMessage(
    examplePacket({
      topic: 'proact/v1/HDPE/Polymer/Line1/Extruder1/events',
      payload,
    }),
  );
  if (!result.ok) throw new Error(result.detail);
  return result.envelope;
}

const OPEN_EVENT = {
  schema_version: '1.0',
  event_id: 'EF-7f2c4a1e',
  revision: '2026-10-11T05:40:05.000Z',
  operation: 'upsert',
  template: 'Production Loss',
  element_path: '\\\\PIAF\\HDPE\\Polymer\\Line1\\Extruder1',
  start_ts: '2026-10-11T05:40:00.000Z',
  end_ts: null,
  attributes: {
    ReasonCode: { name: 'MECH-01', value: 3 },
    Quantity: 12.5,
    Description: 'Conveyor belt tripped',
  },
  attribute_units: { Quantity: 't' },
  ts: '2026-10-11T05:40:05.100Z',
  seq: 1801,
  boot_id: 'gw-01',
  source: 'pi-mqtt-gw-01',
};

describe('mqttFrameOf (plan 1.8 step 3: contract event → PI frame path)', () => {
  it('maps the contract event onto the frame the PI ingest path consumes', () => {
    const { frame, attributes } = mqttFrameOf(decode(OPEN_EVENT));
    expect(frame).toEqual({
      WebId: 'EF-7f2c4a1e',
      Name: null,
      TemplateName: 'Production Loss',
      StartTime: '2026-10-11T05:40:00.000Z',
      EndTime: null,
      Path: '\\\\PIAF\\HDPE\\Polymer\\Line1\\Extruder1',
      PrimaryReferencedElement: {
        WebId: null,
        Path: '\\\\PIAF\\HDPE\\Polymer\\Line1\\Extruder1',
      },
      SourceRevision: '2026-10-11T05:40:05.000Z',
    });
    expect(attributes).toEqual({
      ReasonCode: { Name: 'MECH-01', Value: 3, IsSystem: false },
      Quantity: 12.5,
      Description: 'Conveyor belt tripped',
    });
  });

  it('carries a closed interval end time', () => {
    const { frame } = mqttFrameOf(
      decode({ ...OPEN_EVENT, end_ts: '2026-10-11T06:09:00.000Z' }),
    );
    expect(frame.EndTime).toBe('2026-10-11T06:09:00.000Z');
  });

  it('refuses envelopes that are not interval events (a delete is a retraction)', () => {
    const retraction = decode({
      schema_version: '1.0',
      event_id: 'EF-7f2c4a1e',
      revision: '2026-10-11T06:05:00.000Z',
      operation: 'delete',
      ts: '2026-10-11T06:05:00.050Z',
      seq: 1830,
      boot_id: 'gw-01',
    });
    expect(() => mqttFrameOf(retraction)).toThrow('not an interval event');
  });
});
