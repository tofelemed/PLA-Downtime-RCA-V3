import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart';
import { ChartFigure } from '@/features/ux-kit/chart-figure';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { ChartTable } from './chart-table';
import { NumberTooltipContent } from './number-tooltip-content';

/** The accessible categorical palette (src/index.css `--chart-1..8`, UX_AUDIT C-1). */
export const CHART_COLORS = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `hsl(var(--chart-${n}))`);

export function ChartEmpty({ message = 'No data in selected range' }: { message?: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

interface ChartCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function ChartCard({ title, description, children, className }: ChartCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

interface LabelValuePoint {
  label: string;
  value: number;
  count?: number;
}

export function CategoryBarChart({
  data,
  valueLabel = 'Value',
  layout = 'vertical',
}: {
  data: LabelValuePoint[];
  valueLabel?: string;
  layout?: 'vertical' | 'horizontal';
}) {
  const { axis: tick } = useNumberFormat();
  if (!data.length) return <ChartEmpty />;

  const chartData = data.map((d) => ({ name: d.label, value: d.value }));
  const config: ChartConfig = {
    value: { label: valueLabel, color: CHART_COLORS[0] },
  };

  const rows = data.map((d) => ({ key: d.label, label: d.label, values: [d.value] }));
  const table = <ChartTable caption={valueLabel} headers={['Category', valueLabel]} rows={rows} />;
  const caption = `Bar chart of ${valueLabel.toLowerCase()} for ${data.length} categories.`;
  const chart =
    layout === 'vertical' ? (
      <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={tick} />
        <YAxis dataKey="name" type="category" width={110} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
        <ChartTooltip content={<NumberTooltipContent chartConfig={config} />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} />
      </BarChart>
    ) : (
      <BarChart data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
        <YAxis tickLine={false} axisLine={false} tickFormatter={tick} />
        <ChartTooltip content={<NumberTooltipContent chartConfig={config} />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} />
      </BarChart>
    );

  return (
    <ChartFigure caption={caption} table={table}>
      <ChartContainer config={config} className="h-[300px] w-full">
        {chart}
      </ChartContainer>
    </ChartFigure>
  );
}

export function DistributionPieChart({ data }: { data: LabelValuePoint[] }) {
  if (!data.length) return <ChartEmpty />;

  const chartData = data.map((d, i) => ({
    name: d.label,
    value: d.value,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const config: ChartConfig = chartData.reduce(
    (acc, item) => ({ ...acc, [item.name]: { label: item.name, color: item.fill } }),
    {} as ChartConfig,
  );

  const rows = data.map((d) => ({ key: d.label, label: d.label, values: [d.value] }));
  return (
    <ChartFigure caption={`Pie chart of the distribution over ${data.length} categories.`} table={<ChartTable caption="Distribution" headers={['Category', 'Value']} rows={rows} />}>
      <ChartContainer config={config} className="mx-auto h-[300px] w-full max-w-md">
        <PieChart>
          <ChartTooltip content={<NumberTooltipContent chartConfig={config} nameKey="name" />} />
          <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
          <Legend />
        </PieChart>
      </ChartContainer>
    </ChartFigure>
  );
}

interface DaySeriesPoint {
  date: string;
  value: number;
  count?: number;
}

export function TrendLineChart({
  data,
  valueLabel = 'Value',
  showCount = false,
}: {
  data: DaySeriesPoint[];
  valueLabel?: string;
  showCount?: boolean;
}) {
  const { axis: tick } = useNumberFormat();
  if (!data.length) return <ChartEmpty />;

  const config: ChartConfig = {
    value: { label: valueLabel, color: CHART_COLORS[0] },
    count: { label: 'Count', color: CHART_COLORS[4] },
  };

  const headers = showCount ? ['Date', valueLabel, 'Count'] : ['Date', valueLabel];
  const rows = data.map((d) => ({ key: d.date, label: d.date, values: showCount ? [d.value, d.count] : [d.value] }));
  return (
    <ChartFigure caption={`Line chart of ${valueLabel.toLowerCase()} over ${data.length} days.`} table={<ChartTable caption={valueLabel} headers={headers} rows={rows} />}>
      <ChartContainer config={config} className="h-[300px] w-full">
        <LineChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <YAxis yAxisId="left" tickLine={false} axisLine={false} tickFormatter={tick} />
          {showCount && <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tickFormatter={tick} />}
          <ChartTooltip content={<NumberTooltipContent chartConfig={config} />} />
          <Legend />
          <Line yAxisId="left" type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} dot={{ r: 3 }} />
          {showCount && (
            <Line yAxisId="right" type="monotone" dataKey="count" stroke="var(--color-count)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
          )}
        </LineChart>
      </ChartContainer>
    </ChartFigure>
  );
}

interface OeePeriodPoint {
  label: string;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
}

export function OeeMultiLineChart({ data }: { data: OeePeriodPoint[] }) {
  const { axis: tick } = useNumberFormat();
  if (!data.length) return <ChartEmpty />;

  const chartData = data.map((d) => ({ period: d.label, ...d }));
  const config: ChartConfig = {
    oee: { label: 'OEE', color: CHART_COLORS[0] },
    availability: { label: 'Availability', color: CHART_COLORS[1] },
    performance: { label: 'Performance', color: CHART_COLORS[2] },
    quality: { label: 'Quality', color: CHART_COLORS[3] },
  };

  const rows = data.map((d) => ({ key: d.label, label: d.label, values: [d.oee, d.availability, d.performance, d.quality] }));
  const table = <ChartTable caption="OEE by period" headers={['Period', 'OEE', 'Availability', 'Performance', 'Quality']} rows={rows} />;
  return (
    <ChartFigure caption={`Line chart of OEE, availability, performance and quality over ${data.length} periods.`} table={table}>
      <ChartContainer config={config} className="h-[320px] w-full">
        <LineChart data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <YAxis tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={tick} />
          <ChartTooltip content={<NumberTooltipContent chartConfig={config} />} />
          <Legend />
          <Line type="monotone" dataKey="oee" stroke="var(--color-oee)" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="availability" stroke="var(--color-availability)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="performance" stroke="var(--color-performance)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="quality" stroke="var(--color-quality)" strokeWidth={2} dot={false} />
        </LineChart>
      </ChartContainer>
    </ChartFigure>
  );
}

export function OeeComponentsBar({ data }: { data: Array<{ label: string; value: number }> }) {
  const { axis: tick } = useNumberFormat();
  if (!data.length || data.every((d) => !d.value)) return <ChartEmpty />;

  const chartData = data.map((d) => ({ name: d.label, value: d.value }));
  const config: ChartConfig = {
    value: { label: 'Score', color: CHART_COLORS[0] },
  };

  const rows = data.map((d) => ({ key: d.label, label: d.label, values: [d.value] }));
  return (
    <ChartFigure caption={`Bar chart of ${data.length} OEE component scores.`} table={<ChartTable caption="OEE components" headers={['Component', 'Score']} rows={rows} />}>
      <ChartContainer config={config} className="h-[280px] w-full">
        <BarChart data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <YAxis tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={tick} />
          <ChartTooltip content={<NumberTooltipContent chartConfig={config} />} />
          <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartFigure>
  );
}

interface ParetoPoint {
  label: string;
  value: number;
  cumulative: number;
}

export function LossParetoChart({ data }: { data: ParetoPoint[] }) {
  const { axis: tick } = useNumberFormat();
  if (!data.length) return <ChartEmpty />;

  const chartData = data.map((d) => ({ name: d.label, cost: d.value, cumulative: d.cumulative }));
  const config: ChartConfig = {
    cost: { label: 'Cost', color: CHART_COLORS[0] },
    cumulative: { label: 'Cumulative %', color: CHART_COLORS[4] },
  };

  const rows = data.map((d) => ({ key: d.label, label: d.label, values: [d.value, d.cumulative] }));
  return (
    <ChartFigure caption={`Pareto of cost for ${data.length} causes, largest first, with the cumulative share.`} table={<ChartTable caption="Loss Pareto" headers={['Cause', 'Cost', 'Cumulative %']} rows={rows} />}>
      <ChartContainer config={config} className="h-[320px] w-full">
        <ComposedChart data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <YAxis yAxisId="left" tickLine={false} axisLine={false} tickFormatter={tick} />
          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} tickFormatter={tick} />
          <ChartTooltip content={<NumberTooltipContent chartConfig={config} />} />
          <Legend />
          <Bar yAxisId="left" dataKey="cost" fill="var(--color-cost)" radius={[4, 4, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="var(--color-cumulative)" strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ChartContainer>
    </ChartFigure>
  );
}
