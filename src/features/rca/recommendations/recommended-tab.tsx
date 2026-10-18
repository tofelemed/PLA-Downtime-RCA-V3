import { useState } from 'react';
import { FormField } from '@/features/ux-kit/form-field';
import { useUnitNames } from '../use-unit-names';
import { RecommendationQueue } from './recommendation-queue';

/** The "Recommended" tab of `/rca`: open recommendations, optionally for one unit (filtered by the server). */
export function RecommendedTab() {
  const { units } = useUnitNames();
  const [unitId, setUnitId] = useState('');
  return (
    <div className="space-y-3">
      <FormField id="recommendation-unit" label="Unit" className="sm:w-64">
        <select id="recommendation-unit" className="h-10 w-full rounded border bg-background px-2 text-sm" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
          <option value="">All units</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name}
            </option>
          ))}
        </select>
      </FormField>
      <RecommendationQueue unitId={unitId || undefined} />
    </div>
  );
}
