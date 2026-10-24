import type { RcaRecommendationItem } from '@/api/v2/types/rca';
import { FormField } from '@/features/ux-kit/form-field';
import { NATIVE_SELECT_CLASS } from './native-select';

export interface RecommendationSelectProps {
  id: string;
  value: string;
  recommendations: readonly RcaRecommendationItem[];
  onChange: (recommendationId: string) => void;
}

/**
 * Item 5: the case recommendation an action implements (optional). A linked recommendation that was
 * deleted from the case stays selectable, so editing never drops the link silently.
 */
export function RecommendationSelect({ id, value, recommendations, onChange }: RecommendationSelectProps) {
  const listed = recommendations.some((rec) => rec.id === value);
  return (
    <FormField id={id} label="Implements recommendation">
      <select id={id} className={NATIVE_SELECT_CLASS} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">None</option>
        {value && !listed && <option value={value}>A removed recommendation</option>}
        {recommendations.map((rec) => (
          <option key={rec.id} value={rec.id}>
            {rec.title}
          </option>
        ))}
      </select>
    </FormField>
  );
}
