import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePlantSelection } from '../contexts/PlantSelectionContext';
import { reportingApi, AuditTrailReport } from '../services/api/reportingApi';
import { auditApi, parseAuditDetails } from '../services/api/auditApi';
import { userApi, UserRecord } from '../services/api/userApi';
import { ApiError } from '../services/api/httpClient';
import {
  ChartCard,
  CategoryBarChart,
  DistributionPieChart,
  TrendLineChart,
} from '@/components/reports/ReportCharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Shield, RefreshCw, Search, Download, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AuditEntry {
  id: string;
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  details?: string;
  createdAt?: string;
  timestamp?: string;
}

function defaultDateRange() {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  LOGIN: 'bg-purple-100 text-purple-800',
  LOGOUT: 'bg-gray-100 text-gray-800',
};

export default function AuditLogs() {
  const { session } = useAuth();
  const { selection: plantSelection } = usePlantSelection();
  const { toast } = useToast();
  const defaults = defaultDateRange();

  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [loading, setLoading] = useState(false);
  const [audit, setAudit] = useState<AuditTrailReport | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  const tenantId = plantSelection?.tenant?.id || session?.tenant?.id;

  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => map.set(u.id, u.name));
    return map;
  }, [users]);

  const resolveUserName = useCallback(
    (entry: AuditEntry) => {
      const parsed = parseAuditDetails(entry.details);
      if (parsed.userName) return parsed.userName;
      if (entry.userId && userMap.has(entry.userId)) return userMap.get(entry.userId)!;
      return entry.userId || 'Unknown';
    },
    [userMap],
  );

  const loadAudit = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const query = {
        tenantId,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(`${endDate}T23:59:59`).toISOString(),
      };
      const [reportData, userList] = await Promise.all([
        reportingApi.getAuditTrail(query),
        // the actor filter is a convenience: a role without the admin-only user list keeps an empty filter
        userApi.getUsers({ tenantId }).catch((error: unknown) =>
          error instanceof ApiError && error.status === 403 ? ([] as UserRecord[]) : Promise.reject(error),
        ),
      ]);
      setAudit(reportData);
      setUsers(userList);
    } catch (error: any) {
      toast({
        title: 'Failed to load audit logs',
        description: error.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [tenantId, startDate, endDate, toast]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  const entries = useMemo(() => {
    const raw = (audit?.data || []) as AuditEntry[];
    return raw.filter((entry) => {
      const parsed = parseAuditDetails(entry.details);
      const userName = resolveUserName(entry);
      const matchesSearch =
        !search ||
        [entry.action, entry.entityType, entry.entityId, parsed.message, userName]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(search.toLowerCase()));
      const matchesAction = actionFilter === 'all' || entry.action === actionFilter;
      const matchesEntity = entityFilter === 'all' || entry.entityType === entityFilter;
      return matchesSearch && matchesAction && matchesEntity;
    });
  }, [audit, search, actionFilter, entityFilter, resolveUserName]);

  const exportCsv = () => {
    const rows = [
      ['Time', 'User', 'Action', 'Entity Type', 'Entity ID', 'Details'],
      ...entries.map((e) => {
        const parsed = parseAuditDetails(e.details);
        return [
          fmtDate(e.createdAt || e.timestamp),
          resolveUserName(e),
          e.action || '',
          e.entityType || '',
          e.entityId || '',
          parsed.message || e.details || '',
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!session) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="w-8 h-8 text-blue-600" />
            Audit Logs
          </h1>
          <p className="text-muted-foreground mt-1">
            Complete system audit trail — who changed what and when
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
          <Button onClick={loadAudit} disabled={loading} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={exportCsv} variant="outline" disabled={!entries.length}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {audit && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Entries</p><p className="text-3xl font-bold">{audit.summary.total}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Action Types</p><p className="text-3xl font-bold">{audit.summary.byAction.length}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Entity Types</p><p className="text-3xl font-bold">{audit.summary.byEntityType.length}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Filtered Results</p><p className="text-3xl font-bold">{entries.length}</p></CardContent></Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Activity Trend" description="Daily audit log volume">
              <TrendLineChart data={audit.charts?.activityByDay || []} valueLabel="Entries" showCount />
            </ChartCard>
            <ChartCard title="By Action" description="Most common actions">
              <CategoryBarChart data={audit.charts?.byAction || []} valueLabel="Count" layout="horizontal" />
            </ChartCard>
            <ChartCard title="By Entity Type" description="What was audited">
              <DistributionPieChart data={audit.charts?.byEntityType || []} />
            </ChartCard>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audit Log Entries</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search user, action, entity..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Action" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    {audit.summary.byAction.map((a) => (
                      <SelectItem key={a.key} value={a.key}>{a.key}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={entityFilter} onValueChange={setEntityFilter}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Entity type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All entities</SelectItem>
                    {audit.summary.byEntityType.map((e) => (
                      <SelectItem key={e.key} value={e.key}>{e.key}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {entries.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No audit entries match your filters.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-left">
                        <th className="pb-2 pr-4">Time</th>
                        <th className="pb-2 pr-4">User</th>
                        <th className="pb-2 pr-4">Action</th>
                        <th className="pb-2 pr-4">Entity</th>
                        <th className="pb-2 pr-4">Summary</th>
                        <th className="pb-2">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => {
                        const parsed = parseAuditDetails(entry.details);
                        const actionKey = (entry.action || '').split(' ')[0].toUpperCase();
                        return (
                          <tr key={entry.id} className="border-b border-gray-100 hover:bg-muted/30">
                            <td className="py-2 pr-4 whitespace-nowrap">{fmtDate(entry.createdAt || entry.timestamp)}</td>
                            <td className="py-2 pr-4">{resolveUserName(entry)}</td>
                            <td className="py-2 pr-4">
                              <Badge className={ACTION_COLORS[actionKey] || 'bg-slate-100 text-slate-800'} variant="outline">
                                {entry.action}
                              </Badge>
                            </td>
                            <td className="py-2 pr-4">
                              <span className="font-medium">{entry.entityType}</span>
                              <span className="block font-mono text-xs text-muted-foreground truncate max-w-[120px]">{entry.entityId}</span>
                            </td>
                            <td className="py-2 pr-4 text-xs text-muted-foreground max-w-xs truncate">{parsed.message || '—'}</td>
                            <td className="py-2">
                              <Button size="sm" variant="ghost" onClick={() => setSelectedEntry(entry)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Audit Entry Details</DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-3 text-sm">
              <div><span className="text-muted-foreground">Time:</span> {fmtDate(selectedEntry.createdAt || selectedEntry.timestamp)}</div>
              <div><span className="text-muted-foreground">User:</span> {resolveUserName(selectedEntry)}</div>
              <div><span className="text-muted-foreground">Action:</span> {selectedEntry.action}</div>
              <div><span className="text-muted-foreground">Entity:</span> {selectedEntry.entityType} / {selectedEntry.entityId}</div>
              <div>
                <span className="text-muted-foreground">Details:</span>
                <pre className="mt-1 p-3 bg-muted rounded text-xs whitespace-pre-wrap break-all">
                  {parseAuditDetails(selectedEntry.details).message || selectedEntry.details || '—'}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
