import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { IntegrationConnectionService } from '../../intake/connections/integration-connection.service';
import { IntegrationConnection } from '../../intake/entities/integration-connection.entity';
import { CanonicalEnvelope } from '../../intake/envelope/canonical-envelope';
import { parseMqttConfig } from '../../intake/adapters/mqtt/mqtt-config';
import { decodeMqttMessage } from '../../intake/adapters/mqtt/profiles';
import { Signal } from '../../signals/entities/signal.entity';
import { sameUnit } from '../../signals/measurement-value';
import { MqttPreviewV2Dto } from './mqtt-preview-v2.dto';

@Injectable()
export class MqttPreviewV2Service {
  constructor(
    private readonly connections: IntegrationConnectionService,
    @InjectRepository(Signal) private readonly signals: Repository<Signal>,
  ) {}

  async preview(context: RequestContext, id: string, body: MqttPreviewV2Dto) {
    const connection = await this.connections.get(context, id);
    if (connection.sourceType !== 'mqtt')
      throw new UnprocessableEntityException({
        code: 'MQTT_REQUIRED',
        message: 'Choose an MQTT connection',
      });
    const decoded = decodePacket(connection, context, body);
    if (!decoded.ok)
      return { ok: false, code: decoded.code, detail: decoded.detail };
    const envelope = decoded.envelope;
    const sourceKey =
      envelope.values?.sample?.signalRef ?? envelope.values?.state?.stateRef;
    const binding =
      sourceKey && !envelope.sourceControls?.mqtt?.availability
        ? await this.binding(context, {
            id,
            sourceKey,
            at: envelope.observedAt,
          })
        : null;
    return previewView(envelope, binding);
  }

  private binding(
    context: RequestContext,
    key: { id: string; sourceKey: string; at: string },
  ) {
    return scopedQuery(this.signals, 's', { context, unitProperty: 'unitId' })
      .andWhere('s.connectionId = :id AND s.sourceKey = :sourceKey', key)
      .andWhere(
        's.effectiveFrom <= :at AND (s.effectiveTo IS NULL OR s.effectiveTo > :at)',
        key,
      )
      .orderBy('s.effectiveFrom', 'DESC')
      .getOne();
  }
}

function decodePacket(
  connection: IntegrationConnection,
  context: RequestContext,
  body: MqttPreviewV2Dto,
) {
  const config = parseMqttConfig(connection.endpointConfig);
  return decodeMqttMessage({
    connection: {
      tenantId: requireTenantId(context),
      connectionId: connection.id,
      configVersion: connection.configVersion,
      config,
    },
    topic: body.topic,
    payload: Buffer.from(body.payload, 'utf8'),
    receivedAt: new Date(body.receivedAt),
    retained: body.retained ?? false,
    qos: config.mqtt.qos,
    dup: false,
  });
}
function bindingStatus(envelope: CanonicalEnvelope, binding: Signal | null) {
  if (envelope.sourceControls?.mqtt?.availability) return 'source_health_only';
  if (!envelope.values?.sample?.signalRef && !envelope.values?.state?.stateRef)
    return 'event_mapping_required';
  if (!binding) return 'unknown_signal_or_out_of_scope';
  if (envelope.kind === 'state' && binding.semanticType !== 'state')
    return 'state_signal_required';
  const unit = envelope.values?.sample?.unit;
  if (binding.canonicalUom && unit && !sameUnit(binding.canonicalUom, unit))
    return 'unit_conflict';
  return 'bound';
}
function previewView(envelope: CanonicalEnvelope, binding: Signal | null) {
  return {
    ok: true,
    kind: envelope.kind,
    observedAt: envelope.observedAt,
    quality: envelope.quality,
    values: envelope.values,
    sourceKey:
      envelope.values?.sample?.signalRef ??
      envelope.values?.state?.stateRef ??
      null,
    availability: envelope.sourceControls?.mqtt?.availability === true,
    binding: binding
      ? {
          signalId: binding.id,
          name: binding.name,
          unitId: binding.unitId,
          semanticType: binding.semanticType,
          canonicalUom: binding.canonicalUom,
        }
      : null,
    bindingStatus: bindingStatus(envelope, binding),
  };
}
