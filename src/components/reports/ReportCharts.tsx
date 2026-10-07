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
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

export const CHART_COLORS = [
  'hsl(221, 83%, 53%)',
  'hsl(142, 71%, 45%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 84%, 60%)',
  'hsl(262, 83%, 58%)',
  'hsl(199, 89%, 48%)',
  'hsl(330, 81%, 60%)',
  'hsl(173, 58%, 39%)',
];

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
  if (!data.length) return <ChartEmpty />;

  const chartData = data.map((d) => ({ name: d.label, value: d.value }));
  const config: ChartConfig = {
    value: { label: valueLabel, color: CHART_COLORS[0] },
  };

  if (layout === 'vertical') {
    return (
      <ChartContainer config={config} className="h-[300px] w-full">
        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} />
          <YAxis dataKey="name" type="category" width={110} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer config={config} className="h-[300px] w-full">
      <BarChart data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
        <YAxis tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
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

  return (
    <ChartContainer config={config} className="mx-auto h-[300px] w-full max-w-md">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
        <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={entry.fill} />
          ))}
        </Pie>
        <Legend />
      </PieChart>
    </ChartContainer>
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
  if (!data.length) return <ChartEmpty />;

  const config: ChartConfig = {
    value: { label: valueLabel, color: CHART_COLORS[0] },
    count: { label: 'Count', color: CHART_COLORS[4] },
  };

  return (
    <ChartContainer config={config} className="h-[300px] w-full">
      <LineChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
        <YAxis yAxisId="left" tickLine={false} axisLine={false} />
        {showCount && <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} />}
        <ChartTooltip content={<ChartTooltipContent />} />
        <Legend />
        <Line yAxisId="left" type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} dot={{ r: 3 }} />
        {showCount && (
          <Line yAxisId="right" type="monotone" dataKey="count" stroke="var(--color-count)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
        )}
      </LineChart>
    </ChartContainer>
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
  if (!data.length) return <ChartEmpty />;

  const chartData = data.map((d) => ({ period: d.label, ...d }));
  const config: ChartConfig = {
    oee: { label: 'OEE', color: CHART_COLORS[0] },
    availability: { label: 'Availability', color: CHART_COLORS[1] },
    performance: { label: 'Performance', color: CHART_COLORS[2] },
    quality: { label: 'Quality', color: CHART_COLORS[3] },
  };

  return (
    <ChartContainer config={config} className="h-[320px] w-full">
      <LineChart data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="period" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} domain={[0, 100]} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Legend />
        <Line type="monotone" dataKey="oee" stroke="var(--color-oee)" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="availability" stroke="var(--color-availability)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="performance" stroke="var(--color-performance)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="quality" stroke="var(--color-quality)" strokeWidth={2} dot={false} />
      </LineChart>
    </ChartContainer>
  );
}

export function OeeComponentsBar({ data }: { data: Array<{ label: string; value: number }> }) {
  if (!data.length || data.every((d) => !d.value)) return <ChartEmpty />;

  const chartData = data.map((d) => ({ name: d.label, value: d.value }));
  const config: ChartConfig = {
    value: { label: 'Score', color: CHART_COLORS[0] },
  };

  return (
    <ChartContainer config={config} className="h-[280px] w-full">
      <BarChart data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} domain={[0, 100]} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

interface ParetoPoint {
  label: string;
  value: number;
  cumulative: number;
}

export function LossParetoChart({ data }: { data: ParetoPoint[] }) {
  if (!data.length) return <ChartEmpty />;

  const chartData = data.map((d) => ({ name: d.label, cost: d.value, cumulative: d.cumulative }));
  const config: ChartConfig = {
    cost: { label: 'Cost', color: CHART_COLORS[0] },
    cumulative: { label: 'Cumulative %', color: CHART_COLORS[4] },
  };

  return (
    <ChartContainer config={config} className="h-[320px] w-full">
      <ComposedChart data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
        <YAxis yAxisId="left" tickLine={false} axisLine={false} />
        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Legend />
        <Bar yAxisId="left" dataKey="cost" fill="var(--color-cost)" radius={[4, 4, 0, 0]} />
        <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="var(--color-cumulative)" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ChartContainer>
  );
}
