import type { ComponentProps, ReactNode } from 'react';
import { type ChartConfig, ChartTooltipContent } from '@/components/ui/chart';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

type TooltipContentProps = ComponentProps<typeof ChartTooltipContent>;

export type NumberTooltipContentProps = TooltipContentProps & {
  /** the chart's config, for the series labels (the shadcn chart context is not exported) */
  chartConfig: ChartConfig;
};

interface TooltipItem {
  color?: string;
  payload?: { fill?: string };
}

/**
 * `ChartTooltipContent` whose values are in the plant's digits (the generated shadcn content formats
 * with the browser locale): colour swatch, series label from the chart config, value right-aligned.
 */
export function NumberTooltipContent({ chartConfig, ...props }: NumberTooltipContentProps) {
  const { axis } = useNumberFormat();
  const formatter = (value: unknown, name: unknown, item: TooltipItem): ReactNode => {
    const key = String(name);
    const label = chartConfig[key]?.label ?? key;
    return (
      <div className="flex flex-1 items-center justify-between gap-2 leading-none">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: item.color ?? item.payload?.fill }} />
          {label}
        </span>
        <span className="font-mono font-medium tabular-nums text-foreground">{typeof value === 'number' ? axis(value) : String(value)}</span>
      </div>
    );
  };
  return <ChartTooltipContent {...props} formatter={formatter as TooltipContentProps['formatter']} />;
}
