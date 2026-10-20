import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { envInt } from '../../common/helpers/time-bounds';
import { IntegrationConnection } from '../../intake/entities/integration-connection.entity';
import { PiFramePayload } from '../pi-envelope';
import { PiEventFrame } from '../pi-frame-ingest.service';
import { readAttributes } from './pi-attribute-reader';
import { assertAnswer, getMany } from './pi-batch';
import { ElementContext, PiAncestorResolver } from './pi-element-ancestors';
import { normalizeFrame, withElementPath } from './pi-frame-shape';
import { PiHttpClient } from './pi-http-client';

/** A PI connection and its client for one read. */
export interface PiSource {
  client: PiHttpClient;
  connection: IntegrationConnection;
}

/**
 * Completes PI frames for intake (PI02): attribute values in one or two batch calls per page and the
 * ancestor WebIds of each primary element (for AF bindings on a parent element). When PI has no batch
 * controller the connection's `capabilities.batch` is set to false once and later reads go per frame.
 */
@Injectable()
export class PiFrameReader {
  private readonly logger = new Logger(PiFrameReader.name);
  private readonly ancestors = new PiAncestorResolver(
    envInt('PI_ELEMENT_CACHE_TTL_MS', 10 * 60_000),
  );

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Frames with attributes and ancestor ids, in the order given. */
  async payloads(
    source: PiSource,
    frames: PiEventFrame[],
  ): Promise<PiFramePayload[]> {
    if (frames.length === 0) return [];
    const read = await readAttributes(
      source.client,
      frames.map((frame) => frame.WebId),
      source.connection.capabilities.batch !== false,
    );
    if (read.batchUnsupported) await this.disableBatch(source.connection);
    const elements = await this.ancestors.resolve(
      source.client,
      source.connection.id,
      frames,
    );
    return frames.map((frame) => ({
      frame: withElement(frame, elements.get(frame.WebId)),
      attributes: read.values.get(frame.WebId) ?? {},
    }));
  }

  /** Frames by WebId (`eventframes/{webId}`); WebIds PI answers 404 for are returned as missing. */
  async framesById(
    source: PiSource,
    webIds: string[],
  ): Promise<{ found: PiEventFrame[]; missing: string[] }> {
    const many = await getMany(
      source.client,
      webIds.map((webId) => `eventframes/${encodeURIComponent(webId)}`),
      source.connection.capabilities.batch !== false,
    );
    if (many.batchUnsupported) await this.disableBatch(source.connection);
    const found: PiEventFrame[] = [];
    const missing: string[] = [];
    many.answers.forEach((answer, index) => {
      assertAnswer(answer, `event frame ${webIds[index]}`, true);
      if (answer.status === 404) missing.push(webIds[index]);
      else found.push(normalizeFrame(answer.content as PiEventFrame));
    });
    return { found, missing };
  }

  private async disableBatch(connection: IntegrationConnection): Promise<void> {
    connection.capabilities = { ...connection.capabilities, batch: false };
    await this.dataSource.query(
      `UPDATE "integration_connections" SET "capabilities" = "capabilities" || '{"batch": false}'::jsonb
        WHERE "id" = $1`,
      [connection.id],
    );
    this.logger.warn(
      `PI connection ${connection.id} has no batch controller; attribute reads go per frame`,
    );
  }
}

/** The frame with its primary element's path (exact-path mappings) and ancestor ids (AF bindings). */
function withElement(
  frame: PiEventFrame,
  element: ElementContext | undefined,
): PiEventFrame {
  const located = withElementPath(frame, element?.path ?? null);
  const ancestors = element?.ancestors ?? [];
  return ancestors.length > 0
    ? { ...located, AncestorElementWebIds: ancestors }
    : located;
}
