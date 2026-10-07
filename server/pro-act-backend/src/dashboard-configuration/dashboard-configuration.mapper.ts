import { DashboardConfiguration } from './dashboard-configuration.entity';

/** Shape sent/received by the frontend dashboard API client */
export interface DashboardConfigApiRecord {
  id: string;
  tenantId?: string;
  organizationId?: string;
  oee?: string;
  losses?: string;
  costs?: string;
  bottleneckRisk?: string;
  display?: string;
  performance?: string;
  quality?: string;
  availability?: string;
  isActive?: boolean;
  version?: number;
  lastModifiedBy?: string | null;
  lastModifiedAt?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export type DashboardConfigApiPayload = Omit<DashboardConfigApiRecord, 'id' | 'createdAt' | 'updatedAt'>;

interface StoredWidgetConfig {
  oee?: string;
  losses?: string;
  costs?: string;
  bottleneckRisk?: string;
  display?: string;
  performance?: string;
  quality?: string;
  availability?: string;
  version?: number;
  lastModifiedBy?: string | null;
  lastModifiedAt?: string | null;
}

function parseWidgetConfig(raw?: string | null): StoredWidgetConfig {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as StoredWidgetConfig;
  } catch {
    return {};
  }
}

export function toApiRecord(entity: DashboardConfiguration): DashboardConfigApiRecord {
  const widget = parseWidgetConfig(entity.widgetConfig);
  return {
    id: entity.id,
    tenantId: entity.tenantId,
    organizationId: entity.organizationId,
    oee: widget.oee ?? '{}',
    losses: widget.losses ?? '{}',
    costs: widget.costs ?? '{}',
    bottleneckRisk: widget.bottleneckRisk ?? '{}',
    display: widget.display ?? '{}',
    performance: widget.performance ?? '{}',
    quality: widget.quality ?? '{}',
    availability: widget.availability ?? '{}',
    isActive: entity.isDefault ?? false,
    version: widget.version ?? 1,
    lastModifiedBy: widget.lastModifiedBy ?? null,
    lastModifiedAt: widget.lastModifiedAt ?? null,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

export function fromApiPayload(data: DashboardConfigApiPayload): Partial<DashboardConfiguration> {
  const widgetConfig = JSON.stringify({
    oee: data.oee ?? '{}',
    losses: data.losses ?? '{}',
    costs: data.costs ?? '{}',
    bottleneckRisk: data.bottleneckRisk ?? '{}',
    display: data.display ?? '{}',
    performance: data.performance ?? '{}',
    quality: data.quality ?? '{}',
    availability: data.availability ?? '{}',
    version: data.version ?? 1,
    lastModifiedBy: data.lastModifiedBy ?? null,
    lastModifiedAt: data.lastModifiedAt ?? new Date().toISOString(),
  } satisfies StoredWidgetConfig);

  return {
    dashboardName: 'Production Plan Dashboard',
    dashboardType: 'production-plan',
    widgetConfig,
    tenantId: data.tenantId,
    organizationId: data.organizationId,
    isDefault: data.isActive ?? true,
    isPublic: false,
  };
}
