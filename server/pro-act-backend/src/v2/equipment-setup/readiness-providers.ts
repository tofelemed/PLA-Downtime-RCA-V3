import { EquipmentReadinessService } from './equipment-readiness.service';
import { ReadinessStore } from './readiness-store';
import { ReadinessRecordsService } from './readiness-records.service';
import { ReadinessProfilesService } from './readiness-profiles.service';
import { ReadinessPoliciesService } from './readiness-policies.service';
import { ReadinessFinanceService } from './readiness-finance.service';
import { ReadinessTelemetryService } from './readiness-telemetry.service';
import { ReadinessWorkflowService } from './readiness-workflow.service';

export const EQUIPMENT_READINESS_SERVICES = [
  EquipmentReadinessService,
  ReadinessStore,
  ReadinessRecordsService,
  ReadinessProfilesService,
  ReadinessPoliciesService,
  ReadinessFinanceService,
  ReadinessTelemetryService,
  ReadinessWorkflowService,
];
