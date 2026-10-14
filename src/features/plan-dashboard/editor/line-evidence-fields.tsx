import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { EvidenceType } from '@/api/v2/types/reconciliation';
import type { ManualDraft } from '../model/draft-lines';
import { CATEGORY_LABELS, EVIDENCE_LABELS, categoriesOf, evidenceTypesOf, needsEvidence } from '../model/line-evidence';

type LineFields = Omit<ManualDraft, 'uid'>;

export interface LineEvidenceFieldsProps {
  line: LineFields;
  onChange: (patch: Partial<LineFields>) => void;
  selectClass: string;
}

/** Category (bridge / Unaccounted, SME R7 / R8) and the record a quantity without an event rests on (SME R11). */
export function LineEvidenceFields({ line, onChange, selectClass }: LineEvidenceFieldsProps) {
  const categories = categoriesOf(line.kind);
  const showEvidence = needsEvidence(line.kind, line.eventIds.length);
  if (!categories.length && !showEvidence) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-3" data-testid="manual-line-evidence">
      {categories.length > 0 && (
        <div className="space-y-1">
          <Label htmlFor="manualCategory">Category</Label>
          <select id="manualCategory" className={selectClass} value={line.classification ?? ''} onChange={(e) => onChange({ classification: e.target.value || undefined })}>
            <option value="">Choose…</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c] ?? c}
              </option>
            ))}
          </select>
        </div>
      )}
      {showEvidence && (
        <>
          <div className="space-y-1">
            <Label htmlFor="manualEvidenceType">Evidence</Label>
            <select id="manualEvidenceType" className={selectClass} value={line.evidenceType ?? ''} onChange={(e) => onChange({ evidenceType: (e.target.value || undefined) as EvidenceType | undefined })}>
              <option value="">Choose…</option>
              {evidenceTypesOf(line.kind).map((t) => (
                <option key={t} value={t}>
                  {EVIDENCE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="manualEvidenceRef">Evidence reference</Label>
            <Input id="manualEvidenceRef" maxLength={200} placeholder="WO-4711, sample B-108, FT-101 delta…" value={line.evidenceRef ?? ''} onChange={(e) => onChange({ evidenceRef: e.target.value || undefined })} />
          </div>
        </>
      )}
    </div>
  );
}
