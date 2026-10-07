import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePlantSelection } from '../contexts/PlantSelectionContext';
import {
  reportingApi,
  OeeSummaryReport,
  ProductionLossReport,
  RcaSummaryReport,
  AuditTrailReport,
  TaskSummaryReport,
  DashboardOverview,
} from '../services/api/reportingApi';
import {
  ChartCard,
  CategoryBarChart,
  DistributionPieChart,
  TrendLineChart,
  OeeMultiLineChart,
  OeeComponentsBar,
  LossParetoChart,
} from '@/components/reports/ReportCharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  RefreshCw,
  Download,
  Gauge,
  TrendingDown,
  FileText,
  Shield,
  CheckSquare,
  LayoutDashboard,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const TABS = ['overview', 'oee', 'loss', 'rca', 'audit', 'tasks'] as const;

function defaultDateRange() {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function pct(n: number) {
  return `${(n * (n <= 1 ? 100 : 1)).toFixed(1)}%`;
}

function money(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function BreakdownTable({
  title,
  rows,
  valueLabel = 'Total',
}: {
  title: string;
  rows: Array<{ key: string; count: number; total?: number }>;
  valueLabel?: string;
}) {
  if (!rows.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">No data in range</CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2">Category</th>
              <th className="pb-2 text-right">Count</th>
              {rows[0].total !== undefined && <th className="pb-2 text-right">{valueLabel}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-gray-100">
                <td className="py-2">{row.key}</td>
                <td className="py-2 text-right">{row.count}</td>
                {row.total !== undefined && <td className="py-2 text-right">{money(row.total)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export default function Reports() {
  const { session } = useAuth();
  const { selection: plantSelection } = usePlantSelection();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab = TABS.includes(tabParam as typeof TABS[number]) ? tabParam! : 'overview';
  const defaults = defaultDateRange();

  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardOverview | null>(null);
  const [oee, setOee] = useState<OeeSummaryReport | null>(null);
  const [loss, setLoss] = useState<ProductionLossReport | null>(null);
  const [rca, setRca] = useState<RcaSummaryReport | null>(null);
  const [audit, setAudit] = useState<AuditTrailReport | null>(null);
  const [tasks, setTasks] = useState<TaskSummaryReport | null>(null);

  const tenantId = plantSelection?.tenant?.id || session?.tenant?.id;

  const loadReports = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const query = {
        tenantId,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(`${endDate}T23:59:59`).toISOString(),
      };
      const [dashRes, oeeRes, lossRes, rcaRes, auditRes, taskRes] = await Promise.all([
        reportingApi.getDashboard(query),
        reportingApi.getOeeSummary(query),
        reportingApi.getProductionLoss(query),
        reportingApi.getRcaSummary(query),
        reportingApi.getAuditTrail(query),
        reportingApi.getTaskSummary(query),
      ]);
      setDashboard(dashRes);
      setOee(oeeRes);
      setLoss(lossRes);
      setRca(rcaRes);
      setAudit(auditRes);
      setTasks(taskRes);
    } catch (error: any) {
      toast({
        title: 'Failed to load reports',
        description: error.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [tenantId, startDate, endDate, toast]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const exportJson = () => {
    const blob = new Blob(
      [JSON.stringify({ dashboard, oee, loss, rca, audit, tasks }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reports-${startDate}-to-${endDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!session) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-blue-600" />
            Reports
          </h1>
          <p className="text-muted-foreground mt-1">
            Executive overview, OEE, production loss, RCA, audit, and task analytics
          </p>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
          </div>
          <Button onClick={loadReports} disabled={loading} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={exportJson} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v })}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview" className="flex items-center gap-1">
            <LayoutDashboard className="w-4 h-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="oee" className="flex items-center gap-1">
            <Gauge className="w-4 h-4" /> OEE
          </TabsTrigger>
          <TabsTrigger value="loss" className="flex items-center gap-1">
            <TrendingDown className="w-4 h-4" /> Loss
          </TabsTrigger>
          <TabsTrigger value="rca" className="flex items-center gap-1">
            <FileText className="w-4 h-4" /> RCA
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-1">
            <Shield className="w-4 h-4" /> Audit
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-1">
            <CheckSquare className="w-4 h-4" /> Tasks
          </TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {dashboard && (
            <>
              <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-5">
                <KpiCard label="Avg OEE" value={dashboard.kpis.oeeRecords ? pct(dashboard.kpis.avgOee) : '—'} sub={`${dashboard.kpis.oeeRecords} records`} />
                <KpiCard label="Loss Events" value={String(dashboard.kpis.lossEvents)} sub={money(dashboard.kpis.totalLossCost)} />
                <KpiCard label="Open RCAs" value={String(dashboard.kpis.rcaOpen)} sub={`${dashboard.kpis.rcaTotal} total`} />
                <KpiCard label="Audit Entries" value={String(dashboard.kpis.auditEntries)} />
                <KpiCard label="Overdue Tasks" value={String(dashboard.kpis.taskOverdue)} sub={`${dashboard.kpis.taskTotal} total`} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard title="Loss Cost Trend" description="Daily production loss cost">
                  <TrendLineChart data={dashboard.charts.lossCostTrend} valueLabel="Cost ($)" />
                </ChartCard>
                <ChartCard title="OEE by Period" description="Multi-metric OEE performance">
                  <OeeMultiLineChart data={dashboard.charts.oeePeriodTrend} />
                </ChartCard>
                <ChartCard title="RCA by Status" description="Investigation pipeline">
                  <DistributionPieChart data={dashboard.charts.rcaByStatus} />
                </ChartCard>
                <ChartCard title="Audit Activity" description="Daily audit log volume">
                  <TrendLineChart data={dashboard.charts.auditActivity} valueLabel="Entries" showCount />
                </ChartCard>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── OEE ── */}
        <TabsContent value="oee" className="space-y-4 mt-4">
          {oee && (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <KpiCard label="OEE Records" value={String(oee.summary.recordCount)} />
                <KpiCard label="Avg Overall OEE" value={oee.summary.recordCount ? pct(oee.summary.avgOverallOEE) : '—'} />
                <KpiCard label="Avg Availability" value={oee.summary.recordCount ? pct(oee.summary.avgAvailability) : '—'} />
                <KpiCard label="Avg Performance" value={oee.summary.recordCount ? pct(oee.summary.avgPerformance) : '—'} />
              </div>
              {oee.fromEvents && (
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardHeader>
                    <CardTitle className="text-base">From Production Events (no OEE records)</CardTitle>
                    <CardDescription>Fallback aggregates from production loss events</CardDescription>
                  </CardHeader>
                  <CardContent className="flex gap-6 text-sm flex-wrap">
                    <span>Events: <strong>{oee.fromEvents.eventCount}</strong></span>
                    <span>Downtime: <strong>{oee.fromEvents.totalDowntimeMinutes} min</strong></span>
                    <span>Cost: <strong>{money(oee.fromEvents.totalCost)}</strong></span>
                  </CardContent>
                </Card>
              )}
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard title="OEE Trend by Period" description="Availability, performance, quality, and OEE">
                  <OeeMultiLineChart data={oee.charts?.periodTrend || []} />
                </ChartCard>
                <ChartCard title="OEE Component Averages" description="Average scores across selected range">
                  <OeeComponentsBar data={oee.charts?.components || []} />
                </ChartCard>
              </div>
              {oee.byPeriod.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">OEE by Period (Table)</CardTitle></CardHeader>
                  <CardContent>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground text-left">
                          <th className="pb-2">Period</th>
                          <th className="pb-2 text-right">OEE</th>
                          <th className="pb-2 text-right">Availability</th>
                          <th className="pb-2 text-right">Performance</th>
                          <th className="pb-2 text-right">Quality</th>
                        </tr>
                      </thead>
                      <tbody>
                        {oee.byPeriod.map((row, i) => (
                          <tr key={i} className="border-b border-gray-100">
                            <td className="py-2">{row.period}</td>
                            <td className="py-2 text-right">{pct(row.overallOEE)}</td>
                            <td className="py-2 text-right">{pct(row.availability)}</td>
                            <td className="py-2 text-right">{pct(row.performance)}</td>
                            <td className="py-2 text-right">{pct(row.quality)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ── Loss ── */}
        <TabsContent value="loss" className="space-y-4 mt-4">
          {loss && (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <KpiCard label="Loss Events" value={String(loss.summary.eventCount)} />
                <KpiCard label="Event Cost" value={money(loss.summary.totalEventCost)} />
                <KpiCard label="Total Duration" value={`${loss.summary.totalDurationMinutes} min`} />
                <KpiCard label="Loss Records" value={String(loss.summary.lossRecordCount)} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard title="Loss Pareto by Category" description="Cost with cumulative percentage line">
                  <LossParetoChart data={loss.charts?.pareto || []} />
                </ChartCard>
                <ChartCard title="Cost by Severity" description="Distribution of loss cost">
                  <DistributionPieChart data={loss.charts?.costBySeverity || []} />
                </ChartCard>
                <ChartCard title="Daily Loss Cost Trend" description="Production loss cost over time">
                  <TrendLineChart data={loss.charts?.costTrendByDay || []} valueLabel="Cost ($)" />
                </ChartCard>
                <ChartCard title="Daily Downtime Trend" description="Total duration (minutes) per day">
                  <TrendLineChart data={loss.charts?.durationTrendByDay || []} valueLabel="Minutes" />
                </ChartCard>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <ChartCard title="Cost by Category" description="Horizontal bar chart">
                  <CategoryBarChart data={loss.charts?.costByCategory || []} valueLabel="Cost ($)" />
                </ChartCard>
                <ChartCard title="Cost by Unit" description="Top units by loss cost">
                  <CategoryBarChart data={loss.charts?.costByUnit || []} valueLabel="Cost ($)" layout="horizontal" />
                </ChartCard>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <BreakdownTable title="By Category" rows={loss.byCategory} />
                <BreakdownTable title="By Severity" rows={loss.bySeverity} />
              </div>
              {loss.topEvents.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Top Cost Events</CardTitle></CardHeader>
                  <CardContent>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground text-left">
                          <th className="pb-2">Description</th>
                          <th className="pb-2">Severity</th>
                          <th className="pb-2 text-right">Cost</th>
                          <th className="pb-2 text-right">Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loss.topEvents.map((e) => (
                          <tr key={e.id} className="border-b border-gray-100">
                            <td className="py-2 max-w-xs truncate">{e.description || e.id}</td>
                            <td className="py-2"><Badge variant="outline">{e.severity || '—'}</Badge></td>
                            <td className="py-2 text-right">{money(e.cost)}</td>
                            <td className="py-2 text-right">{e.duration} min</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ── RCA ── */}
        <TabsContent value="rca" className="space-y-4 mt-4">
          {rca && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <KpiCard label="Total RCAs" value={String(rca.summary.total)} />
                <KpiCard label="Open / Active" value={String(rca.summary.openCount)} />
                <KpiCard label="Closed" value={String(rca.summary.byStatus.find((s) => s.key === 'Closed')?.count || 0)} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard title="RCA by Status" description="Investigation status distribution">
                  <DistributionPieChart data={rca.charts?.byStatus || []} />
                </ChartCard>
                <ChartCard title="RCA by Priority" description="Priority breakdown">
                  <CategoryBarChart data={rca.charts?.byPriority || []} valueLabel="Count" layout="horizontal" />
                </ChartCard>
                <ChartCard title="RCA Creation Trend" description="New investigations over time" className="lg:col-span-2">
                  <TrendLineChart data={rca.charts?.createdTrend || []} valueLabel="RCAs created" showCount />
                </ChartCard>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <BreakdownTable title="By Status" rows={rca.summary.byStatus.map((s) => ({ key: s.key, count: s.count }))} valueLabel="" />
                <BreakdownTable title="By Priority" rows={rca.summary.byPriority.map((s) => ({ key: s.key, count: s.count }))} valueLabel="" />
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Audit ── */}
        <TabsContent value="audit" className="space-y-4 mt-4">
          {audit && (
            <>
              <KpiCard label="Audit Entries" value={String(audit.summary.total)} />
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard title="Audit Activity Trend" description="Daily audit log volume">
                  <TrendLineChart data={audit.charts?.activityByDay || []} valueLabel="Entries" showCount />
                </ChartCard>
                <ChartCard title="Actions Distribution" description="Most common audit actions">
                  <CategoryBarChart data={audit.charts?.byAction || []} valueLabel="Count" layout="horizontal" />
                </ChartCard>
                <ChartCard title="Entity Types" description="Audited entity breakdown">
                  <DistributionPieChart data={audit.charts?.byEntityType || []} />
                </ChartCard>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <BreakdownTable title="By Action" rows={audit.summary.byAction.map((s) => ({ key: s.key, count: s.count }))} valueLabel="" />
                <BreakdownTable title="By Entity Type" rows={audit.summary.byEntityType.map((s) => ({ key: s.key, count: s.count }))} valueLabel="" />
              </div>
              {(audit.recent?.length ?? 0) > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Recent Audit Entries</CardTitle></CardHeader>
                  <CardContent>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground text-left">
                          <th className="pb-2">Time</th>
                          <th className="pb-2">Action</th>
                          <th className="pb-2">Entity</th>
                          <th className="pb-2">Entity ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {audit.recent!.map((entry) => (
                          <tr key={entry.id} className="border-b border-gray-100">
                            <td className="py-2 whitespace-nowrap">{fmtDate(entry.createdAt)}</td>
                            <td className="py-2"><Badge variant="outline">{entry.action}</Badge></td>
                            <td className="py-2">{entry.entityType}</td>
                            <td className="py-2 font-mono text-xs truncate max-w-[120px]">{entry.entityId}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ── Tasks ── */}
        <TabsContent value="tasks" className="space-y-4 mt-4">
          {tasks && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <KpiCard label="Total Tasks" value={String(tasks.summary.total)} />
                <KpiCard label="Overdue" value={String(tasks.summary.overdue)} />
                <KpiCard label="Completed" value={String(tasks.summary.byStatus.find((s) => s.key === 'Completed')?.count || 0)} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard title="Tasks by Status" description="Current workload distribution">
                  <DistributionPieChart data={tasks.charts?.byStatus || []} />
                </ChartCard>
                <ChartCard title="Tasks by Priority" description="Priority breakdown">
                  <CategoryBarChart data={tasks.charts?.byPriority || []} valueLabel="Count" layout="horizontal" />
                </ChartCard>
                <ChartCard title="Task Creation Trend" description="New tasks over time" className="lg:col-span-2">
                  <TrendLineChart data={tasks.charts?.createdTrend || []} valueLabel="Tasks" showCount />
                </ChartCard>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <BreakdownTable title="By Status" rows={tasks.summary.byStatus.map((s) => ({ key: s.key, count: s.count }))} valueLabel="" />
                <BreakdownTable title="By Priority" rows={tasks.summary.byPriority.map((s) => ({ key: s.key, count: s.count }))} valueLabel="" />
              </div>
              <div className="flex justify-end">
                <Button asChild variant="outline" size="sm">
                  <Link to="/tasks">Open Task Management →</Link>
                </Button>
              </div>
              {(tasks.recent?.length ?? 0) > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Recent Tasks</CardTitle></CardHeader>
                  <CardContent>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground text-left">
                          <th className="pb-2">Title</th>
                          <th className="pb-2">Status</th>
                          <th className="pb-2">Priority</th>
                          <th className="pb-2">Due</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasks.recent!.map((t) => (
                          <tr key={t.id} className="border-b border-gray-100">
                            <td className="py-2">{t.title}</td>
                            <td className="py-2"><Badge variant="outline">{t.status}</Badge></td>
                            <td className="py-2">{t.priority}</td>
                            <td className="py-2">{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
