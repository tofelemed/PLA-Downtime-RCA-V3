import React, { useEffect, useState } from 'react';
import { masterDataService, ProductionEvent, ImpactCode, Unit, Asset } from '../services/MasterDataService';
import { Eye, FileText } from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer } from 'recharts';
import { formatDurationSimple } from '../utils/durationFormatter';

interface LossEventTableProps {
  tenantId: string;
  unitId?: string;
  startDate: string;
  endDate: string;
  lossCategory?: string;
  impactCodeId?: string;
  shift?: string;
  onEventClick?: (event: ProductionEvent) => void;
}

function getInitials(name?: string) {
  if (!name) return '?';
  const parts = name.split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const LossEventTable: React.FC<LossEventTableProps> = ({
  tenantId, unitId, startDate, endDate, lossCategory, impactCodeId, shift, onEventClick
}) => {
  const [events, setEvents] = useState<ProductionEvent[]>([]);
  const [impactCodes, setImpactCodes] = useState<ImpactCode[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      masterDataService.getProductionEvents({ tenantId, unitId }),
      masterDataService.getImpactCodes({ tenantId }),
      masterDataService.getUnits(),
      masterDataService.getAssets({ tenantId }),
    ]).then(([ev, codes, units, assets]) => {
      // Filter by date, category, and shift
      const filtered = ev.filter(e => {
        if (!e.startTime) return false;
        const t = new Date(e.startTime).getTime();
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();
        if (t < start || t > end) return false;
        if (lossCategory && e.lossCategory !== lossCategory) return false;
        if (impactCodeId && e.impactCodeId !== impactCodeId) return false;
        if (shift && e.shift !== shift) return false;
        return true;
      });
      setEvents(filtered);
      setImpactCodes(codes);
      setUnits(units);
      setAssets(assets);
      setLoading(false);
    });
  }, [tenantId, unitId, startDate, endDate, lossCategory, impactCodeId, shift]);

  const getUnitName = (id?: string) => units.find(u => u.id === id)?.name || '';
  const getAssetName = (id?: string) => assets.find(a => a.id === id)?.name || '';
  const getImpactCodeName = (id?: string) => impactCodes.find(c => c.id === id)?.name || '';

  // Compute max duration for mini bar scaling
  const maxDuration = Math.max(...events.map(e => Number(e.duration) || 0), 1);

  return (
    <div className="overflow-x-auto rounded-2xl shadow-xl border border-blue-100 bg-gradient-to-br from-white via-blue-50 to-pink-50">
      <table className="min-w-full text-sm border-separate border-spacing-y-2">
        <thead className="sticky top-0 bg-gradient-to-r from-blue-100 to-pink-100 shadow z-10">
          <tr>
            <th className="px-4 py-2 text-left font-bold text-gray-700">Date</th>
            <th className="px-4 py-2 text-left font-bold text-gray-700">Unit</th>
            <th className="px-4 py-2 text-left font-bold text-gray-700">Asset</th>
            <th className="px-4 py-2 text-left font-bold text-gray-700">Category</th>
            <th className="px-4 py-2 text-left font-bold text-gray-700">Loss Type</th>
            <th className="px-4 py-2 text-right font-bold text-gray-700">Duration</th>
            <th className="px-4 py-2 text-center font-bold text-gray-700">Impact</th>
            <th className="px-4 py-2 text-right font-bold text-gray-700">Cost</th>
            <th className="px-4 py-2 text-center font-bold text-gray-700">Shift</th>
            <th className="px-4 py-2 text-left font-bold text-gray-700">Operator</th>
            <th className="px-4 py-2 text-center font-bold text-gray-700">Status</th>
            <th className="px-4 py-2 text-center font-bold text-gray-700">RCA</th>
            <th className="px-4 py-2 text-center font-bold text-gray-700">Actions</th>
          </tr>
        </thead>
        <tbody>
          {events.map((ev, idx) => (
            <tr
              key={ev.id}
              className={
                `transition-all rounded-2xl ${idx % 2 === 0 ? 'bg-white/90' : 'bg-blue-50/80'} hover:bg-pink-50 cursor-pointer`
              }
              onClick={() => onEventClick?.(ev)}
            >
              <td className="px-4 py-2 text-left font-mono">{ev.startTime?.slice(0, 16).replace('T', ' ')}</td>
              <td className="px-4 py-2 text-left">{getUnitName(ev.unitId)}</td>
              <td className="px-4 py-2 text-left">{getAssetName(ev.assetId)}</td>
              <td className="px-4 py-2 text-left">
                <span className={`px-2 py-1 rounded-full text-xs font-semibold
                  ${ev.impactCodeId ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700'}`}>{getImpactCodeName(ev.impactCodeId) || 'Other'}</span>
              </td>
              <td className="px-4 py-2 text-left">
                <span className={`px-2 py-1 rounded-full text-xs font-semibold
                  ${ev.lossCategory === 'Mechanical' ? 'bg-pink-100 text-pink-700' :
                    ev.lossCategory === 'Electrical' ? 'bg-blue-100 text-blue-700' :
                    ev.lossCategory === 'Quality' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'}`}>{ev.lossCategory || 'Other'}</span>
              </td>
              <td className="px-4 py-2 text-right font-mono">{formatDurationSimple(Number(ev.duration) || 0)}</td>
              <td className="px-4 py-2 w-24 text-center">
                <ResponsiveContainer width="100%" height={18}>
                  <BarChart data={[{ value: Number(ev.duration) || 0 }]}> 
                    <Bar
                      dataKey="value"
                      fill="url(#miniBarColor)"
                      radius={[8, 8, 8, 8]}
                      maxBarSize={60}
                      isAnimationActive={false}
                      barSize={Math.max(10, ((Number(ev.duration) || 0) / maxDuration) * 60)}
                    />
                    <defs>
                      <linearGradient id="miniBarColor" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#ec4899" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </td>
              <td className="px-4 py-2 text-right font-mono">{ev.cost}</td>
              <td className="px-4 py-2 text-center">
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">{ev.shift || '-'}</span>
              </td>
              <td className="px-4 py-2 text-left">
                <span className="inline-flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-pink-400 text-white font-bold">
                    {getInitials(ev.operatorName)}
                  </span>
                  <span className="ml-2 text-xs text-gray-700">{ev.operatorName || '-'}</span>
                </span>
              </td>
              <td className="px-4 py-2 text-center">
                <span className={`px-2 py-1 rounded-full text-xs font-semibold
                  ${ev.status === 'Open' ? 'bg-blue-100 text-blue-700' :
                    ev.status === 'Closed' ? 'bg-green-100 text-green-700' :
                    ev.status === 'RCA Required' ? 'bg-pink-100 text-pink-700' :
                    'bg-gray-100 text-gray-700'}`}>{ev.status}</span>
              </td>
              <td className="px-4 py-2 text-center">
                {ev.rcaId ? <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">Yes</span> : <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">No</span>}
              </td>
              <td className="px-4 py-2 text-center align-middle">
                <div className="flex items-center justify-center gap-2">
                  <button
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 hover:bg-indigo-200 text-xs font-semibold shadow"
                    onClick={e => { e.stopPropagation(); onEventClick?.(ev); }}
                    title="Details"
                  >
                    <Eye className="w-4 h-4" /> Details
                  </button>
                  {ev.rcaId && (
                    <button
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-pink-100 text-pink-700 hover:bg-pink-200 text-xs font-semibold shadow"
                      onClick={e => { e.stopPropagation(); /* View RCA logic */ }}
                      title="View RCA"
                    >
                      <FileText className="w-4 h-4" /> RCA
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}; 