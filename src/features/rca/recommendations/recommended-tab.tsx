import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { FIELD_CLASS, SELECT_CLASS } from '@/features/pla-analytics/components/filter-classes';
import { useUnitNames } from '../use-unit-names';
import { RecommendationQueue } from './recommendation-queue';

/** The "Recommended" tab of `/rca`: open recommendations, optionally for one unit (filtered by the server). */
export function RecommendedTab() {
  const { units } = useUnitNames();
  const [unitId, setUnitId] = useState('');
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3" data-testid="recommendation-filters">
        <div className={FIELD_CLASS}>
          <Label htmlFor="recommendation-unit">Unit</Label>
          <select id="recommendation-unit" className={`${SELECT_CLASS} w-full sm:w-64`} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
            <option value="">All units</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <RecommendationQueue unitId={unitId || undefined} />
    </div>
  );
}
