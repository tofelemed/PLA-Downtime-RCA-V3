import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttributeMappingService } from '../attribute-mapping/attribute-mapping.service';
import { PIConnection } from '../pi-connection/pi-connection.entity';
import { PIEvent } from '../pi-event/pi-event.entity';
import { PISyncWatermark } from '../pi-sync-watermark/pi-sync-watermark.entity';
import { SourceMappingService } from '../source-mapping/source-mapping.service';
import { PIWebApiService } from './pi-web-api.service';
import { PiFramePayload } from './pi-envelope';
import { PiIntakeBridge, PiPullScope } from './pi-intake-bridge';
import { FrameOutcome, PiEventFrame } from './pi-frame-ingest.service';
import { PiWindowFetch } from './pi/pi-window-fetch';
import { piEndTime } from './pi/pi-time';

export interface PullEventsRequest {
  tenantId: string;
  startTimeUtc?: string;
  endTimeUtc?: string;
  scopeType?: 'database' | 'element';
  scopeId?: string;
  templateName?: string;
  /** page size (default 500); every page of the window is read (plan 1.6, I8) */
  maxCount?: number;
  autoCreateProductionEvents?: boolean;
}

/** One mapping problem of one frame (plan 1.3: typed mapping and code resolution diagnostics). */
export interface PullDiagnostic {
  eventId: string;
  code: string;
  field: string | null;
  message: string;
}

export interface PullEventsResponse {
  success: boolean;
  eventsFetched: number;
  eventsStored: number;
  productionEventsCreated: number;
  productionEventsUpdated: number;
  productionEventsSkipped: number;
  unmappedEventsCreated: number;
  errors: string[];
  diagnostics: PullDiagnostic[];
  events: PIEvent[];
}

type PullCounters = Omit<PullEventsResponse, 'success' | 'events'>;

const COUNTER_OF: Readonly<Record<FrameOutcome, keyof PullCounters>> = {
  created: 'productionEventsCreated',
  updated: 'productionEventsUpdated',
  // a duplicate delivery (ING01) leaves the event as it is
  unchanged: 'productionEventsSkipped',
  unmapped: 'unmappedEventsCreated',
};

/**
 * On-demand v1 pull: reads every page of the window on the certified PI read path (plan 1.6: TLS on,
 * retries, batched attributes, ancestors, open-frame sentinel), stores the raw frames (v1 `pi_events`)
 * and ingests each one through the durable intake pipeline (plan 1.5 → plans 1.2/1.3). The v1
 * watermark moves only after a pull without errors. Scheduled pulls run as leased ingestion jobs.
 */
@Injectable()
export class PIEventPullService {
  private readonly logger = new Logger(PIEventPullService.name);

  constructor(
    @InjectRepository(PIConnection)
    private readonly piConnectionRepository: Repository<PIConnection>,
    @InjectRepository(PIEvent)
    private readonly piEventRepository: Repository<PIEvent>,
    @InjectRepository(PISyncWatermark)
    private readonly piSyncWatermarkRepository: Repository<PISyncWatermark>,
    private readonly piWebApiService: PIWebApiService,
    private readonly attributeMappings: AttributeMappingService,
    private readonly sourceMappings: SourceMappingService,
    private readonly bridge: PiIntakeBridge,
    private readonly windows: PiWindowFetch,
  ) {}

  async pullEvents(request: PullEventsRequest): Promise<PullEventsResponse> {
    const counters = emptyCounters();
    const events: PIEvent[] = [];
    try {
      const pull = await this.fetchFrames(request);
      counters.eventsFetched = pull.payloads.length;
      const scope = await this.pullScope(request, pull.connection);
      for (const payload of pull.payloads) {
        await this.processFrame(request, scope, payload, { counters, events });
      }
      pull.connection.lastSyncTime = new Date();
      await this.piConnectionRepository.save(pull.connection);
      if (counters.errors.length === 0) {
        await this.upsertWatermark(
          request.tenantId,
          pull.scopeType,
          pull.scopeId,
          pull.endTime,
        );
      }
      return { success: counters.errors.length === 0, ...counters, events };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error pulling events from PI: ${message}`);
      counters.errors.push(message);
      return { success: false, ...counters, events: [] };
    }
  }

  private async fetchFrames(request: PullEventsRequest): Promise<{
    connection: PIConnection;
    scopeType: 'database' | 'element';
    scopeId: string;
    endTime: string;
    payloads: PiFramePayload[];
  }> {
    const connection = await this.piWebApiService.getActiveConnection(
      request.tenantId,
    );
    const { scopeType, scopeId } = this.piWebApiService.resolveScope(
      connection,
      request.scopeType,
      request.scopeId,
    ) as { scopeType: 'database' | 'element'; scopeId: string };
    const endTime = request.endTimeUtc || new Date().toISOString();
    const startTime =
      request.startTimeUtc || new Date(Date.now() - 3600 * 1000).toISOString();
    const { payloads } = await this.windows.fetch(connection, {
      tenantId: request.tenantId,
      scope: { scopeType, scopeId, templateName: request.templateName },
      start: startTime,
      end: endTime,
      pageSize: request.maxCount || 500,
    });
    this.logger.log(
      `Fetched ${payloads.length} event frames from PI for tenant ${request.tenantId}`,
    );
    return { connection, scopeType, scopeId, endTime, payloads };
  }

  async testConnection(
    tenantId: string,
  ): Promise<{ connected: boolean; message: string }> {
    return this.piWebApiService.testConnection(tenantId);
  }

  /**
   * Mapping profile and resolver, loaded once per pull (no per-frame rule queries), and the intake
   * identity of the connection (already mirrored into `integration_connections` by the fetch).
   */
  private async pullScope(
    request: PullEventsRequest,
    connection: PIConnection,
  ): Promise<PiPullScope> {
    const tenantId = request.tenantId;
    return {
      context: {
        tenantId,
        organizationId: connection.organizationId,
        profile: await this.attributeMappings.loadProfile(
          tenantId,
          connection.id,
        ),
        resolver: await this.sourceMappings.loadResolver(
          tenantId,
          connection.id,
        ),
      },
      connectionId: connection.id,
      correlationId: `pi-pull:${new Date().toISOString()}`,
    };
  }

  private async processFrame(
    request: PullEventsRequest,
    scope: PiPullScope,
    payload: PiFramePayload,
    sink: { counters: PullCounters; events: PIEvent[] },
  ): Promise<void> {
    const { frame, attributes } = payload;
    try {
      sink.events.push(
        await this.storeRawFrame(scope.context, frame, attributes),
      );
      sink.counters.eventsStored++;
      if (request.autoCreateProductionEvents === false) return;
      const result = await this.bridge.ingestFrame(scope, frame, attributes);
      sink.counters[COUNTER_OF[result.outcome]]++;
      sink.counters.diagnostics.push(
        ...result.diagnostics.map((entry) => ({
          eventId: frame.WebId,
          ...entry,
        })),
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      sink.counters.errors.push(
        `Failed to process event ${frame.WebId}: ${message}`,
      );
      this.logger.warn(`Failed to process PI event ${frame.WebId}: ${message}`);
    }
  }

  private async storeRawFrame(
    context: PiPullScope['context'],
    frame: PiEventFrame,
    attributes: Record<string, unknown>,
  ): Promise<PIEvent> {
    const existing = await this.piEventRepository.findOne({
      where: { webId: frame.WebId, tenantId: context.tenantId },
    });
    const data: Partial<PIEvent> = {
      webId: frame.WebId,
      tenantId: context.tenantId,
      organizationId: context.organizationId,
      template: frame.TemplateName || undefined,
      name: frame.Name ?? undefined,
      startUtc: frame.StartTime ? new Date(frame.StartTime) : undefined,
      endUtc: piEndTime(frame.EndTime) ?? undefined,
      primaryAfId: frame.PrimaryReferencedElement?.WebId || undefined,
      eventData: JSON.stringify({ ...frame, Attributes: attributes }),
    };
    return this.piEventRepository.save(
      existing
        ? Object.assign(existing, data)
        : this.piEventRepository.create(data),
    );
  }

  private async upsertWatermark(
    tenantId: string,
    scopeType: 'database' | 'element',
    scopeId: string,
    lastEndUtc: string,
  ): Promise<void> {
    const existing = await this.piSyncWatermarkRepository.findOne({
      where: { tenantId, syncType: scopeType, lastSyncMarker: scopeId },
    });
    const payload: Partial<PISyncWatermark> = {
      tenantId,
      syncType: scopeType,
      lastSyncMarker: scopeId,
      lastSyncTimestamp: new Date(lastEndUtc),
      syncStatus: 'success',
    };
    await this.piSyncWatermarkRepository.save(
      existing
        ? Object.assign(existing, payload)
        : this.piSyncWatermarkRepository.create(payload),
    );
  }
}

function emptyCounters(): PullCounters {
  return {
    eventsFetched: 0,
    eventsStored: 0,
    productionEventsCreated: 0,
    productionEventsUpdated: 0,
    productionEventsSkipped: 0,
    unmappedEventsCreated: 0,
    errors: [],
    diagnostics: [],
  };
}
