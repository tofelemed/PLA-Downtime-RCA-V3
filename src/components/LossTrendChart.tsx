import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { masterDataService, ProductionEvent } from '../services/MasterDataService';
import { formatDurationSimple, formatDurationTooltip } from '../utils/durationFormatter';

interface LossTrendChartProps {
  tenantId: string;
  unitId?: string;
  startDate: string;
  endDate: string;
  groupBy?: 'day' | 'week' | 'shift';
  lossCategory?: string; // Optional: filter by category
  impactCodeId?: string; // Optional: filter by impact code
}

export const LossTrendChart: React.FC<LossTrendChartProps> = ({
  tenantId, unitId, startDate, endDate, groupBy = 'day', lossCategory, impactCodeId
}) => {
  const [events, setEvents] = useState<ProductionEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    masterDataService.getProductionEvents({ tenantId, unitId }).then(ev => {
      // Filter by date range and (optionally) category
      const filtered = ev.filter(e => {
        if (!e.startTime) return false;
        const t = new Date(e.startTime).getTime();
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();
        if (t < start || t > end) return false;
        if (lossCategory && e.lossCategory !== lossCategory) return false;
        if (impactCodeId && e.impactCodeId !== impactCodeId) return false;
        return true;
      });
      setEvents(filtered);
      setLoading(false);
    });
  }, [tenantId, unitId, startDate, endDate, lossCategory, impactCodeId]);

  // Group and aggregate
  const trendMap: Record<string, number> = {};
  for (const event of events) {
    let key = '';
    if (groupBy === 'day') {
      key = event.startTime?.slice(0, 10) || '';
    } else if (groupBy === 'week') {
      const d = new Date(event.startTime || '');
      const yearStart = new Date(d.getFullYear(), 0, 1);
      const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7);
      key = `${d.getFullYear()}-W${week}`;
    } else if (groupBy === 'shift') {
      key = event.shift || 'Unknown';
    }
    if (!key) continue;
    trendMap[key] = (trendMap[key] || 0) + (Number(event.duration) || 0);
  }
  const trendArray = Object.entries(trendMap)
    .map(([period, value]) => ({ period, value }))
    .sort((a, b) => a.period.localeCompare(b.period));

  return (
    <div className="bg-white rounded-xl shadow p-4 mb-6">
      <h3 className="text-lg font-semibold mb-2">Loss Trend ({groupBy})</h3>
      {loading ? <div>Loading...</div> : (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={trendArray} margin={{ left: 40, right: 20, top: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" tick={{ fill: '#334155', fontSize: 14 }} />
            <YAxis tick={{ fill: '#334155', fontSize: 14 }} />
            <Tooltip
              contentStyle={{ background: '#fff', borderRadius: '0.5rem', border: '1px solid #e0e7ef' }}
              labelStyle={{ color: '#6366f1', fontWeight: 600 }}
              formatter={(value: any) => [formatDurationSimple(value), 'Duration']}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#6366f1"
              strokeWidth={3}
              dot={{ r: 4, fill: '#ec4899', stroke: '#6366f1', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#6366f1', stroke: '#ec4899', strokeWidth: 2 }}
              name="Loss Duration"
              isAnimationActive={true}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}; 