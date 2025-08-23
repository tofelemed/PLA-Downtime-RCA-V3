import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts';
import { masterDataService, ProductionEvent, ImpactCode } from '../services/MasterDataService';

interface LossParetoChartProps {
  tenantId: string;
  unitId?: string;
  startDate: string;
  endDate: string;
  onCategoryClick?: (categoryId: string) => void;
}

export const LossParetoChart: React.FC<LossParetoChartProps> = ({ tenantId, unitId, startDate, endDate, onCategoryClick }) => {
  const [events, setEvents] = useState<ProductionEvent[]>([]);
  const [impactCodes, setImpactCodes] = useState<ImpactCode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      masterDataService.getProductionEvents({ tenantId, unitId }),
      masterDataService.getImpactCodes({ tenantId }),
    ]).then(([ev, codes]) => {
      // Filter events by startDate and endDate client-side
      const filteredEvents = ev.filter(event => {
        if (!event.startTime) return false;
        const eventTime = new Date(event.startTime).getTime();
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();
        return eventTime >= start && eventTime <= end;
      });
      setEvents(filteredEvents);
      setImpactCodes(codes);
      setLoading(false);
    });
  }, [tenantId, unitId, startDate, endDate]);

  // Aggregate by impactCodeId
  const lossMap: Record<string, { duration: number; cost: number; count: number }> = {};
  for (const event of events) {
    const key = event.impactCodeId || 'Uncategorized';
    if (!lossMap[key]) lossMap[key] = { duration: 0, cost: 0, count: 0 };
    lossMap[key].duration += Number(event.duration) || 0;
    lossMap[key].cost += Number(event.cost) || 0;
    lossMap[key].count += 1;
  }
  const lossArray = Object.entries(lossMap)
    .map(([key, value]) => ({
      categoryId: key,
      categoryName: impactCodes.find(c => c.id === key)?.name || 'Uncategorized',
      ...value,
    }))
    .sort((a, b) => b.duration - a.duration);

  // Prepare data for Recharts
  const chartData = lossArray.map(cat => ({
    name: cat.categoryName,
    duration: cat.duration,
    cost: cat.cost,
    categoryId: cat.categoryId,
  }));

  return (
    <div className="bg-white rounded-xl shadow p-4 mb-6">
      <h3 className="text-lg font-semibold mb-2">Pareto of Loss Categories</h3>
      {loading ? <div>Loading...</div> : (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 40, right: 20, top: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fill: '#334155', fontSize: 14 }} />
            <YAxis dataKey="name" type="category" tick={{ fill: '#334155', fontSize: 14 }} width={120} />
            <Tooltip
              contentStyle={{ background: '#fff', borderRadius: '0.5rem', border: '1px solid #e0e7ef' }}
              labelStyle={{ color: '#6366f1', fontWeight: 600 }}
              formatter={(value: any, name: string) => [`${value} min`, name === 'duration' ? 'Duration' : 'Cost']}
            />
            <Bar
              dataKey="duration"
              fill="url(#barColor)"
              radius={[8, 8, 8, 8]}
              onClick={data => onCategoryClick?.(data.categoryId)}
              cursor="pointer"
            >
              <LabelList dataKey="duration" position="right" fill="#6366f1" fontSize={14} />
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