import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LossParetoChart } from '../components/LossParetoChart';
import { PlanWaterfallChart } from '../components/PlanWaterfallChart';
import { LossTrendChart } from '../components/LossTrendChart';
import { LossEventTable } from '../components/LossEventTable';
import { usePlantSelection } from '../contexts/PlantSelectionContext';
import { BarChart3, TrendingDown, List, Info, ArrowDownRight, UserCircle2, Search } from 'lucide-react';
import { masterDataService, ProductionEvent } from '../services/MasterDataService';

const unitOptions = [
  { value: '', label: 'All Units' },
  { value: 'unit1', label: 'Unit 1' },
  { value: 'unit2', label: 'Unit 2' },
];
const categoryOptions = [
  { value: '', label: 'All Categories' },
  { value: 'Mechanical', label: 'Mechanical' },
  { value: 'Electrical', label: 'Electrical' },
  { value: 'Quality', label: 'Quality' },
];
const shiftOptions = [
  { value: '', label: 'All Shifts' },
  { value: 'A', label: 'Shift A' },
  { value: 'B', label: 'Shift B' },
  { value: 'C', label: 'Shift C' },
];

const PLADashboard: React.FC = () => {
  const { session } = useAuth();
  const { selection: plantSelection } = usePlantSelection();

  // Example: last 30 days
  const today = new Date();
  const defaultEnd = today.toISOString().slice(0, 10);
  const defaultStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [selectedUnitId, setSelectedUnitId] = useState<string | undefined>('');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>('');
  const [selectedShift, setSelectedShift] = useState<string | undefined>('');
  const [selectedPlan, setSelectedPlan] = useState<any>(undefined); // Replace with real plan selection logic
  const [events, setEvents] = useState<ProductionEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Fetch all events for KPIs and summary (filtered by date/unit/category/shift)
  React.useEffect(() => {
    setLoadingEvents(true);
    masterDataService.getProductionEvents({ tenantId: session?.tenant?.id, unitId: selectedUnitId || undefined }).then(ev => {
      const filtered = ev.filter(e => {
        if (!e.startTime) return false;
        const t = new Date(e.startTime).getTime();
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();
        if (t < start || t > end) return false;
        if (selectedCategory && e.lossCategory !== selectedCategory) return false;
        if (selectedShift && e.shift !== selectedShift) return false;
        return true;
      });
      setEvents(filtered);
      setLoadingEvents(false);
    });
  }, [session?.tenant?.id, selectedUnitId, startDate, endDate, selectedCategory, selectedShift]);

  // KPI Calculations
  const totalLoss = useMemo(() => events.reduce((sum, e) => sum + (Number(e.duration) || 0), 0), [events]);
  const eventCount = events.length;
  const topCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of events) {
      const cat = e.lossCategory || 'Other';
      map[cat] = (map[cat] || 0) + (Number(e.duration) || 0);
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
  }, [events]);
  const topUnit = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of events) {
      const unit = e.unitId || 'Other';
      map[unit] = (map[unit] || 0) + (Number(e.duration) || 0);
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
  }, [events]);

  // Top 3 loss events
  const topEvents = useMemo(() => {
    return [...events].sort((a, b) => (Number(b.duration) || 0) - (Number(a.duration) || 0)).slice(0, 3);
  }, [events]);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
      {/* Filters Bar */}
      <div className="flex flex-wrap gap-4 items-end mb-6 bg-gradient-to-r from-blue-50 to-pink-50 rounded-2xl p-4 shadow-xl border border-blue-100">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Start Date</label>
          <input type="date" className="rounded-full border px-3 py-1 bg-white shadow" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">End Date</label>
          <input type="date" className="rounded-full border px-3 py-1 bg-white shadow" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Unit</label>
          <select className="rounded-full border px-3 py-1 bg-white shadow" value={selectedUnitId} onChange={e => setSelectedUnitId(e.target.value)}>
            {unitOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
          <select className="rounded-full border px-3 py-1 bg-white shadow" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
            {categoryOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Shift</label>
          <select className="rounded-full border px-3 py-1 bg-white shadow" value={selectedShift} onChange={e => setSelectedShift(e.target.value)}>
            {shiftOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Search className="w-4 h-4" />
          <span>Active Filters:</span>
          <span>{startDate} to {endDate}</span>
          {selectedUnitId && <span>• Unit: {selectedUnitId}</span>}
          {selectedCategory && <span>• Category: {selectedCategory}</span>}
          {selectedShift && <span>• Shift: {selectedShift}</span>}
        </div>
        <div className="text-xs text-gray-400 ml-auto">Last updated: {new Date().toLocaleString()}</div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-r from-indigo-500 to-pink-500 text-white rounded-2xl shadow-xl p-4 flex flex-col items-start">
          <span className="text-xs font-semibold uppercase mb-1">Total Loss (min)</span>
          <span className="text-2xl font-bold">{loadingEvents ? '...' : totalLoss}</span>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-4 flex flex-col items-start border-l-4 border-indigo-500">
          <span className="text-xs font-semibold uppercase mb-1">Top Loss Category</span>
          <span className="text-lg font-bold">{loadingEvents ? '...' : topCategory}</span>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-4 flex flex-col items-start border-l-4 border-pink-500">
          <span className="text-xs font-semibold uppercase mb-1">Most Impacted Unit</span>
          <span className="text-lg font-bold">{loadingEvents ? '...' : topUnit}</span>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-4 flex flex-col items-start border-l-4 border-blue-500">
          <span className="text-xs font-semibold uppercase mb-1">Events Recorded</span>
          <span className="text-lg font-bold">{loadingEvents ? '...' : eventCount}</span>
        </div>
      </div>

      {/* Top 3 Loss Events */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {topEvents.map(ev => (
          <div key={ev.id} className="bg-gradient-to-br from-pink-50 via-blue-50 to-white rounded-2xl shadow-xl border border-blue-100 p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1">
              <UserCircle2 className="w-6 h-6 text-indigo-400" />
              <span className="font-semibold text-indigo-700">{ev.operatorName || 'Operator'}</span>
              <span className="ml-auto text-xs text-gray-400">{ev.startTime?.slice(0, 16).replace('T', ' ')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5">{ev.lossCategory || 'Other'}</span>
              <span className="text-xs bg-pink-100 text-pink-700 rounded-full px-2 py-0.5">{ev.unitId}</span>
              <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">{ev.shift || '-'}</span>
            </div>
            <div className="text-lg font-bold text-pink-600">{ev.duration} min</div>
            <div className="text-xs text-gray-600 line-clamp-2">{ev.description}</div>
          </div>
        ))}
      </div>

      {/* Pareto Chart Section */}
      <div className="bg-gradient-to-br from-white via-blue-50 to-pink-50 rounded-2xl shadow-xl border border-blue-100 p-6 mb-10">
        <div className="flex items-center mb-4">
          <BarChart3 className="w-7 h-7 text-indigo-500 mr-3" />
          <h3 className="text-2xl font-extrabold bg-gradient-to-r from-indigo-600 to-pink-500 bg-clip-text text-transparent">
            Pareto of Loss Categories
          </h3>
          <span className="ml-2 text-xs text-gray-400 flex items-center">
            <Info className="w-4 h-4 mr-1" />Click a bar to filter below
          </span>
        </div>
        <LossParetoChart
          tenantId={session?.tenant?.id}
          unitId={selectedUnitId}
          startDate={startDate}
          endDate={endDate}
          onCategoryClick={setSelectedCategory}
        />
      </div>

      {/* Waterfall Chart Section */}
      {selectedPlan && (
        <div className="bg-gradient-to-br from-white via-pink-50 to-blue-50 rounded-2xl shadow-xl border border-pink-100 p-6 mb-10">
          <div className="flex items-center mb-4">
            <TrendingDown className="w-7 h-7 text-pink-500 mr-3" />
            <h3 className="text-2xl font-extrabold bg-gradient-to-r from-pink-600 to-indigo-500 bg-clip-text text-transparent">
              Planned vs. Actual Waterfall
            </h3>
            <span className="ml-2 text-xs text-gray-400 flex items-center">
              <Info className="w-4 h-4 mr-1" />Shows how planned output is reduced by losses
            </span>
          </div>
          <PlanWaterfallChart plan={selectedPlan} tenantId={session?.tenant?.id} />
        </div>
      )}

      {/* Trend Chart Section */}
      <div className="bg-gradient-to-br from-white via-blue-50 to-pink-50 rounded-2xl shadow-xl border border-blue-100 p-6 mb-10">
        <div className="flex items-center mb-4">
          <ArrowDownRight className="w-7 h-7 text-blue-500 mr-3" />
          <h3 className="text-2xl font-extrabold bg-gradient-to-r from-blue-600 to-pink-500 bg-clip-text text-transparent">
            Loss Trend Over Time
          </h3>
          <span className="ml-2 text-xs text-gray-400 flex items-center">
            <Info className="w-4 h-4 mr-1" />Track loss trends by day, week, or shift
          </span>
        </div>
        <LossTrendChart
          tenantId={session?.tenant?.id}
          unitId={selectedUnitId}
          startDate={startDate}
          endDate={endDate}
          groupBy="day"
          lossCategory={selectedCategory}
        />
      </div>

      {/* Drilldown Table Section */}
      <div className="bg-gradient-to-br from-white via-blue-50 to-pink-50 rounded-2xl shadow-xl border border-gray-200 p-6 mb-10">
        <div className="flex items-center mb-4">
          <List className="w-7 h-7 text-gray-500 mr-3" />
          <h3 className="text-2xl font-extrabold text-gray-800">
            Loss Event Drilldown
          </h3>
          <span className="ml-2 text-xs text-gray-400 flex items-center">
            <Info className="w-4 h-4 mr-1" />Click a row for event details
          </span>
        </div>
        <LossEventTable
          tenantId={session?.tenant?.id}
          unitId={selectedUnitId}
          startDate={startDate}
          endDate={endDate}
          lossCategory={selectedCategory}
          shift={selectedShift}
          onEventClick={ev => {/* Optionally open event details or RCA modal */}}
        />
      </div>
    </div>
  );
};

export default PLADashboard; 