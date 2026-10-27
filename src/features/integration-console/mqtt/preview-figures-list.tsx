import { PlantTime } from '@/features/ux-kit/plant-time';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { previewFigures, type PreviewFigure } from './model/preview-figures';

function FigureValue({ figure, timezone }: { figure: PreviewFigure; timezone: string }) {
  const { number } = useNumberFormat();
  const { value } = figure;
  if (figure.time && typeof value === 'string') return <PlantTime iso={value} tz={timezone} withDate />;
  if (typeof value === 'number') return <>{number(value, Number.isInteger(value) ? 0 : 2)}</>;
  if (typeof value === 'string') return <>{value}</>;
  return <code className="text-xs">{JSON.stringify(value)}</code>;
}

/** The decoded values of a feed message: PLA output and OT report figures, or the downtime stop. */
export function PreviewFigures({ response, timezone }: { response: unknown; timezone: string }) {
  const figures = previewFigures(response);
  if (figures.length === 0) return null;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded border p-2 text-xs" data-testid="sample-figures">
      {figures.map((figure) => (
        <div key={figure.label} className="contents">
          <dt className="text-muted-foreground">{figure.label}</dt>
          <dd className="break-all">
            <FigureValue figure={figure} timezone={timezone} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
