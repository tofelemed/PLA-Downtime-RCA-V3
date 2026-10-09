import { createLogger } from '@/lib/logger';
import { seedOilGasData } from '@/scripts/seedOilGasData';
import { debugRCAData } from '@/scripts/debugRCAData';
import { rcaTriggerConfigService } from '@/services/RCATriggerConfigService';
import { rcaKnowledgeBaseService } from '@/services/RCAKnowledgeBaseService';
import { rcaAnalysisConfigService } from '@/services/RCAAnalysisConfigService';
import { autoPIEventSyncService } from '@/services/pi/AutoPIEventSyncService';

const log = createLogger('dev');

/**
 * Console helpers for local development (seeders, debug dumps, service handles). Loaded only behind
 * `import.meta.env.DEV` (main.tsx), so none of it — and none of the legacy seeders — is in a production
 * bundle (plan 3.1 step 7).
 */
export function registerDebugGlobals(): void {
  const globals = window as unknown as Record<string, unknown>;
  globals.seedOilGasData = seedOilGasData;
  globals.debugRCAData = debugRCAData;
  globals.debugProductionLosses = async () => {
    const { debugProductionLosses } = await import('@/scripts/debugProductionLosses');
    return debugProductionLosses();
  };
  globals.rcaTriggerConfigService = rcaTriggerConfigService;
  globals.rcaKnowledgeBaseService = rcaKnowledgeBaseService;
  globals.rcaAnalysisConfigService = rcaAnalysisConfigService;
  globals.autoPIEventSyncService = autoPIEventSyncService;
  log.info('Dev helpers on window: seedOilGasData(), debugRCAData(), debugProductionLosses(), RCA/PI services');
}
