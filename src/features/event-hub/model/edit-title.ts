import type { ProductionEventView } from '@/api/v2/types/events';
import { labelOf, PHYSICAL_TYPE_LABELS } from '@/features/ux-kit/labels';

/**
 * E-3: the edit page names what is edited — "Unit 100 · Stop from 2026-10-15 22:39" (plant time; glossary:
 * a downtime event is a Stop, other kinds keep their label).
 */
export function editTitleOf(
  event: Pick<ProductionEventView, 'unitId' | 'startTime' | 'classification'>,
  unitName: (id: string) => string,
  dateTime: (iso: string) => string,
): string {
  const physicalType = event.classification.physicalType;
  const kind = physicalType === 'downtime' ? 'Stop' : labelOf(PHYSICAL_TYPE_LABELS, physicalType);
  return `${unitName(event.unitId)} · ${kind} from ${dateTime(event.startTime)}`;
}
