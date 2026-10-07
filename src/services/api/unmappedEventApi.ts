import { httpClient } from './httpClient';

export interface UnmappedEventDto {
  id: string;
  tenantId?: string;
  organizationId?: string;
  unitId?: string;
  eventName?: string;
  eventType?: string;
  startTime?: string;
  endTime?: string;
  sourceSystem?: string;
  sourceId?: string;
  eventData?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUnmappedEventPayload {
  tenantId?: string;
  organizationId?: string;
  unitId?: string;
  eventName?: string;
  eventType?: string;
  startTime?: string;
  endTime?: string;
  sourceSystem?: string;
  sourceId?: string;
  eventData?: string;
  /** Convenience fields merged into eventData by the client before send */
  reason?: string;
  suggestions?: string[];
  event?: Record<string, unknown>;
}

export interface UnmappedEventQuery {
  tenantId?: string;
  unitId?: string;
}

export interface UnmappedEventRecord {
  id: string;
  tenantId?: string;
  organizationId?: string;
  unitId?: string;
  eventName?: string;
  eventType?: string;
  startTime?: string;
  endTime?: string;
  sourceSystem?: string;
  sourceId?: string;
  reason?: string;
  suggestions: string[];
  event: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export function mapUnmappedEventDto(dto: UnmappedEventDto): UnmappedEventRecord {
  let parsed: {
    reason?: string;
    suggestions?: string[];
    event?: Record<string, unknown>;
  } = {};

  if (dto.eventData) {
    try {
      parsed = JSON.parse(dto.eventData);
    } catch {
      parsed = {};
    }
  }

  return {
    id: dto.id,
    tenantId: dto.tenantId,
    organizationId: dto.organizationId,
    unitId: dto.unitId,
    eventName: dto.eventName,
    eventType: dto.eventType,
    startTime: dto.startTime,
    endTime: dto.endTime,
    sourceSystem: dto.sourceSystem,
    sourceId: dto.sourceId,
    reason: parsed.reason,
    suggestions: parsed.suggestions || [],
    event:
      parsed.event ||
      ({
        eventId: dto.sourceId,
        id: dto.sourceId,
        name: dto.eventName,
        eventType: dto.eventType,
        startTime: dto.startTime,
        endTime: dto.endTime,
        source: dto.sourceSystem,
      } as Record<string, unknown>),
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

function buildPayload(data: CreateUnmappedEventPayload): CreateUnmappedEventPayload {
  const { reason, suggestions, event, eventData, ...rest } = data;

  if (eventData) {
    return { ...rest, eventData };
  }

  if (reason || suggestions || event) {
    const existing = rest as CreateUnmappedEventPayload;
    return {
      ...existing,
      eventData: JSON.stringify({
        reason,
        suggestions: suggestions || [],
        event: event || {
          eventId: existing.sourceId,
          id: existing.sourceId,
          name: existing.eventName,
          eventType: existing.eventType,
          startTime: existing.startTime,
          endTime: existing.endTime,
          source: existing.sourceSystem,
        },
      }),
    };
  }

  return rest;
}

class UnmappedEventApi {
  private basePath = '/unmapped-events';

  async list(query?: UnmappedEventQuery): Promise<UnmappedEventDto[]> {
    const response = await httpClient.get<UnmappedEventDto[]>(this.basePath, { params: query });
    return response.data;
  }

  async get(id: string): Promise<UnmappedEventDto> {
    const response = await httpClient.get<UnmappedEventDto>(`${this.basePath}/${id}`);
    return response.data;
  }

  async create(payload: CreateUnmappedEventPayload): Promise<UnmappedEventDto> {
    const response = await httpClient.post<UnmappedEventDto>(this.basePath, buildPayload(payload));
    return response.data;
  }

  async update(id: string, payload: Partial<CreateUnmappedEventPayload>): Promise<UnmappedEventDto> {
    const response = await httpClient.put<UnmappedEventDto>(
      `${this.basePath}/${id}`,
      buildPayload(payload as CreateUnmappedEventPayload),
    );
    return response.data;
  }

  async delete(id: string): Promise<void> {
    await httpClient.delete(`${this.basePath}/${id}`);
  }
}

export const unmappedEventApi = new UnmappedEventApi();
