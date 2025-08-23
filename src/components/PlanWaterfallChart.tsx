import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts';
import { masterDataService, ProductionPlan, ProductionEvent } from '../services/MasterDataService';

interface PlanWaterfallChartProps {
  plan: ProductionPlan;
  tenantId: string;
}

export const PlanWaterfallChart: React.FC<PlanWaterfallChartProps> = ({ plan, tenantId }) => {
  const [events, setEvents] = useState<ProductionEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    masterDataService.getProductionEvents({ tenantId, unitId: plan.unitId }).then(ev => {
      // Filter events for this plan and within plan date range
      const filtered = ev.filter(e =>
        e.planId === plan.id &&
        e.startTime &&
        new Date(e.startTime) >= new Date(plan.startDate) &&
        new Date(e.startTime) <= new Date(plan.endDate)
      );
      setEvents(filtered);
      setLoading(false);
    });
  }, [tenantId, plan]);

  // Aggregate losses by category
  const lossMap: Record<string, number> = {};
  let totalLoss = 0;
  for (const event of events) {
    const cat = event.lossCategory || 'Other';
    const qty = Number(event.quantity) || 0;
    lossMap[cat] = (lossMap[cat] || 0) + qty;
    totalLoss += qty;
  }
  const actual = plan.plannedQuantity - totalLoss;

  // Prepare data for waterfall chart
  const waterfallData = [
    { label: 'Planned', value: plan.plannedQuantity, color: '#6366f1' },
    ...Object.entries(lossMap).map(([cat, val]) => ({ label: `-${cat}`, value: -val, color: '#ec4899' })),
    { label: 'Actual', value: actual, color: '#10b981' }
  ];

  // For Recharts, build cumulative values for waterfall effect
  let cumulative = 0;
  const rechartsData = waterfallData.map((d, i) => {
    const prev = cumulative;
    cumulative += d.value;
    return {
      ...d,
      start: prev,
      end: cumulative,
      barValue: d.value,
      index: i,
    };
  });

  return (
    <div className="bg-white rounded-xl shadow p-4 mb-6">
      <h3 className="text-lg font-semibold mb-2">Planned vs. Actual Waterfall</h3>
      {loading ? <div>Loading...</div> : (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={rechartsData} layout="vertical" margin={{ left: 40, right: 20, top: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fill: '#334155', fontSize: 14 }} />
            <YAxis dataKey="label" type="category" tick={{ fill: '#334155', fontSize: 14 }} width={120} />
            <Tooltip
              contentStyle={{ background: '#fff', borderRadius: '0.5rem', border: '1px solid #e0e7ef' }}
              labelStyle={{ color: '#6366f1', fontWeight: 600 }}
              formatter={(value: any, name: string) => [`${value}`, name === 'barValue' ? 'Change' : '']}
            />
            <Bar
              dataKey="barValue"
              fill="url(#barColor)"
              radius={[8, 8, 8, 8]}
              isAnimationActive={true}
            >
              <LabelList dataKey="end" position="right" fill="#6366f1" fontSize={14} formatter={v => `${v}`} />
            </Bar>
            <defs>
              <linearGradient id="barColor" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}; 