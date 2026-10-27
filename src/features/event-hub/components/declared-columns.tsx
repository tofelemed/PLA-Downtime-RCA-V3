import type { ProductionEventView } from '@/api/v2/types/events';
import type { DataTableColumn } from '@/features/ux-kit/data-table';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { isProductionLoss } from '../model/production-loss';

type Figure = 'planned' | 'actual' | 'shortfall';

function Tonnes({ event, figure }: { event: ProductionEventView; figure: Figure }) {
  const { decimal } = useNumberFormat();
  const value = isProductionLoss(event) ? event.declaredFigures?.[figure] : null;
  if (value === null || value === undefined) return null;
  return <span data-testid={`event-declared-${figure}`}>{decimal(String(value), 3)}</span>;
}

const figureColumn = (id: string, header: string, figure: Figure): DataTableColumn<ProductionEventView> => ({
  id,
  header,
  headerLabel: `${header} (t)`,
  nowrap: true,
  align: 'right',
  cell: (event) => <Tonnes event={event} figure={figure} />,
});

/** Declared mode: the day's planned and actual output and the lost tonnes (blank for any other kind of event). */
export function declaredColumns(): DataTableColumn<ProductionEventView>[] {
  return [figureColumn('planned', 'Planned', 'planned'), figureColumn('actual', 'Actual', 'actual'), figureColumn('lost', 'Lost', 'shortfall')];
}
