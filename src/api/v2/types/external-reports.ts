/** OT's own figures kept with an MQTT PLA report for comparison (plans/MQTT_FEEDS.md, PLA handler). */
export interface ExternalReportSourceFigures {
  planned: number | string | null;
  actual: number | string | null;
  shortfall: number | string | null;
  uom: string | null;
  status: string | null;
  quality: string | null;
  plant: string | null;
  eventType: string | null;
  topic: string | null;
}

export interface ExternalReportLineView {
  unitId: string;
  productId: string;
  gross: number | string | null;
  good: number | string | null;
  reject: number | string | null;
  uom: string | null;
}

/** `GET /api/v2/external-production-reports` item (backend `ExternalReportV2View`). */
export interface ExternalReportV2View {
  id: string;
  externalReportId: string;
  externalRevision: string;
  siteId: string;
  localProductionDate: string;
  timezone: string;
  utcStart: string;
  utcEnd: string;
  basis: string;
  lines: ExternalReportLineView[];
  sourceStatus: string;
  sourceSystem: string;
  statusMappingId: string | null;
  /** released per the source status rules of the source system (counts as a period actual) */
  certifiedEligible: boolean;
  approvedAtSource: string | null;
  evidenceRef: string | null;
  /** `current` | `superseded` */
  state: string;
  supersededById: string | null;
  importedAt: string;
  /** MQTT reports: the connection that received the report */
  connectionId: string | null;
  sourceFigures: ExternalReportSourceFigures | null;
}
