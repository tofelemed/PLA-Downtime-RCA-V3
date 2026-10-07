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
      // Filter events within plan date range (not just by planId)
      const filtered = ev.filter(e =>
        e.startTime &&
        new Date(e.startTime) >= new Date(plan.startDate) &&
        new Date(e.startTime) <= new Date(plan.endDate) &&
        (e.eventType === 'ProductionLoss' || e.eventType === 'ProductionOutput')
      );
      setEvents(filtered);
      setLoading(false);
    }).catch(error => {
      console.error('Error loading production events:', error);
      setEvents([]);
      setLoading(false);
    });
  }, [tenantId, plan]);

  // Separate production losses and outputs
  const lossEvents = events.filter(e => e.eventType === 'ProductionLoss');
  const outputEvents = events.filter(e => e.eventType === 'ProductionOutput');
  
  // Aggregate losses by category
  const lossMap: Record<string, number> = {};
  let totalLoss = 0;
  for (const event of lossEvents) {
    const cat = event.lossCategory || 'Other';
    const qty = Number(event.quantity) || 0;
    lossMap[cat] = (lossMap[cat] || 0) + qty;
    totalLoss += qty;
  }
  
  // Calculate actual production from output events
  let actualProduction = 0;
  for (const event of outputEvents) {
    actualProduction += Number(event.quantity) || 0;
  }
  
  // If we have actual production data from events, use it; otherwise use plan's actualQuantity or calculate from plan minus losses
  const actual = actualProduction > 0 
    ? actualProduction 
    : (plan.actualQuantity && plan.actualQuantity > 0) 
      ? plan.actualQuantity 
      : Math.max(0, plan.plannedQuantity - totalLoss);

  // Prepare data for waterfall chart
  const lossEntries = Object.entries(lossMap);
  const waterfallData = [
    { label: 'Planned', value: plan.plannedQuantity, color: '#6366f1' },
    ...lossEntries.map(([cat, val]) => ({ label: `-${cat}`, value: -val, color: '#ec4899' })),
    // If no loss events but we have actual data, show the gap as "Unaccounted Loss"
    ...(lossEntries.length === 0 && plan.actualQuantity && plan.actualQuantity > 0 && actualProduction === 0 ? 
      [{ label: '-Unaccounted Loss', value: -(plan.plannedQuantity - plan.actualQuantity), color: '#f59e0b' }] : 
      []),
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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Planned vs. Actual Waterfall</h3>
        <div className="text-sm text-gray-600">
          {events.length} events • {lossEvents.length} losses • {outputEvents.length} outputs
        </div>
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center h-80">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading production data...</span>
        </div>
      ) : events.length === 0 && (!plan.actualQuantity || plan.actualQuantity <= 0) ? (
        <div className="text-center py-8">
          <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <span className="text-2xl">📊</span>
          </div>
          <h4 className="text-lg font-medium text-gray-900 mb-2">No Production Events Found</h4>
          <p className="text-gray-500 mb-4">
            No production events found for this plan period, but plan shows actual production data.<br/>
            <span className="text-sm">Period: {new Date(plan.startDate).toLocaleDateString()} - {new Date(plan.endDate).toLocaleDateString()}</span>
          </p>
          {plan.actualQuantity && plan.actualQuantity > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <h5 className="font-medium text-green-900">Plan Actual Data Available</h5>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm text-green-800">
                <div>
                  <span className="font-medium">Planned:</span> {plan.plannedQuantity.toLocaleString()} MT
                </div>
                <div>
                  <span className="font-medium">Actual:</span> {plan.actualQuantity.toLocaleString()} MT
                </div>
                <div className="col-span-2">
                  <span className="font-medium">Performance:</span> {((plan.actualQuantity / plan.plannedQuantity) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          )}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
            <h5 className="font-medium text-blue-900 mb-2">Data Sources:</h5>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Production Loss events (eventType: 'ProductionLoss')</li>
              <li>• Production Output events (eventType: 'ProductionOutput')</li>
              <li>• Events within plan date range for unit: {plan.unitId}</li>
            </ul>
          </div>
        </div>
      ) : (
        <div>
          {events.length === 0 && plan.actualQuantity && plan.actualQuantity > 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                <span className="text-sm font-medium text-amber-800">
                  Showing plan actual data (no detailed event breakdown available)
                </span>
              </div>
            </div>
          )}
          <ResponsiveContainer width="100%" height={320}>
          <BarChart data={rechartsData} layout="vertical" margin={{ left: 40, right: 20, top: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              type="number" 
              tick={{ fill: '#334155', fontSize: 14 }}
              tickFormatter={(value) => `${(value / 1000).toFixed(1)}K`}
            />
            <YAxis dataKey="label" type="category" tick={{ fill: '#334155', fontSize: 14 }} width={120} />
            <Tooltip
              contentStyle={{ background: '#fff', borderRadius: '0.5rem', border: '1px solid #e0e7ef' }}
              labelStyle={{ color: '#6366f1', fontWeight: 600 }}
              formatter={(value: any, name: string) => [
                `${Number(value).toLocaleString()} MT`, 
                name === 'barValue' ? 'Change' : ''
              ]}
            />
            <Bar
              dataKey="barValue"
              fill="url(#barColor)"
              radius={[8, 8, 8, 8]}
              isAnimationActive={true}
            >
              <LabelList 
                dataKey="end" 
                position="right" 
                fill="#6366f1" 
                fontSize={14} 
                formatter={(v) => `${(Number(v) / 1000).toFixed(1)}K`} 
              />
            </Bar>
            <defs>
              <linearGradient id="barColor" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
        </div>
      )}
      
      {/* Debug Information */}
      {(events.length > 0 || (plan.actualQuantity && plan.actualQuantity > 0)) && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <span className="font-medium">Planned:</span> {plan.plannedQuantity.toLocaleString()} MT
            </div>
            <div>
              <span className="font-medium">Plan Actual:</span> {plan.actualQuantity?.toLocaleString() || 'N/A'} MT
            </div>
            <div>
              <span className="font-medium">Event Output:</span> {actualProduction.toLocaleString()} MT
            </div>
            <div>
              <span className="font-medium">Total Loss:</span> {totalLoss.toLocaleString()} MT
            </div>
            <div>
              <span className="font-medium">Final Actual:</span> {actual.toLocaleString()} MT
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-300 text-xs text-gray-500">
            <span className="font-medium">Data Source:</span> {
              actualProduction > 0 ? 'Production Events' : 
              (plan.actualQuantity && plan.actualQuantity > 0) ? 'Plan Actual Quantity' : 
              'Calculated (Planned - Losses)'
            }
          </div>
        </div>
      )}
    </div>
  );
}; 