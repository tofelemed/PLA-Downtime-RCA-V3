import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttributeMappingService } from '../attribute-mapping/attribute-mapping.service';
import { PIConnection } from '../pi-connection/pi-connection.entity';
import { PIEvent } from '../pi-event/pi-event.entity';
import { PISyncWatermark } from '../pi-sync-watermark/pi-sync-watermark.entity';
import { SourceMappingService } from '../source-mapping/source-mapping.service';
import { PIWebApiService } from './pi-web-api.service';
import { fetchEventFrameAttributes } from './pi-event-mapper';
import {
  FrameContext,
  FrameOutcome,
  PiEventFrame,
  PiFrameIngestService,
} from './pi-frame-ingest.service';

export interface PullEventsRequest {
  tenantId: string;
  startTimeUtc?: string;
  endTimeUtc?: string;
  scopeType?: 'database' | 'element';
  scopeId?: string;
  templateName?: string;
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

/** Pulls PI event frames, stores the raw frames and ingests each one (plan 1.2/1.3). */
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
    private readonly ingest: PiFrameIngestService,
  ) {}

  async pullEvents(request: PullEventsRequest): Promise<PullEventsResponse> {
    const counters = emptyCounters();
    const events: PIEvent[] = [];
    try {
      const pull = await this.fetchFrames(request);
      counters.eventsFetched = pull.frames.length;
      const context = await this.frameContext(
        request.tenantId,
        pull.connection,
      );
      for (const frame of pull.frames) {
        await this.processFrame(request, context, frame, { counters, events });
      }
      pull.connection.lastSyncTime = new Date();
      await this.piConnectionRepository.save(pull.connection);
      await this.upsertWatermark(
        request.tenantId,
        pull.scopeType,
        pull.scopeId,
        pull.endTime,
      );
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
    frames: PiEventFrame[];
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
    const data = (await this.piWebApiService.getEventFrames(request.tenantId, {
      scopeType,
      scopeId,
      startTimeUtc: startTime,
      endTimeUtc: endTime,
      templateName: request.templateName,
      maxCount: request.maxCount || 200,
    })) as { Items?: PiEventFrame[] } | null;
    const frames = data?.Items ?? [];
    this.logger.log(
      `Fetched ${frames.length} event frames from PI for tenant ${request.tenantId}`,
    );
    return { connection, scopeType, scopeId, endTime, frames };
  }

  async testConnection(
    tenantId: string,
  ): Promise<{ connected: boolean; message: string }> {
    return this.piWebApiService.testConnection(tenantId);
  }

  /** Mapping profile and resolver, loaded once per pull (no per-frame rule queries). */
  private async frameContext(
    tenantId: string,
    connection: PIConnection,
  ): Promise<FrameContext> {
    return {
      tenantId,
      organizationId: connection.organizationId,
      profile: await this.attributeMappings.loadProfile(
        tenantId,
        connection.id,
      ),
      resolver: await this.sourceMappings.loadResolver(tenantId, connection.id),
    };
  }

  private async processFrame(
    request: PullEventsRequest,
    context: FrameContext,
    frame: PiEventFrame,
    sink: { counters: PullCounters; events: PIEvent[] },
  ): Promise<void> {
    try {
      const requestFn = (path: string) =>
        this.piWebApiService.request(request.tenantId, path);
      const attributes = await fetchEventFrameAttributes(
        requestFn,
        frame.WebId,
      );
      sink.events.push(await this.storeRawFrame(context, frame, attributes));
      sink.counters.eventsStored++;
      if (request.autoCreateProductionEvents === false) return;
      const result = await this.ingest.ingest(context, frame, attributes);
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
    context: FrameContext,
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
      endUtc: frame.EndTime ? new Date(frame.EndTime) : undefined,
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
