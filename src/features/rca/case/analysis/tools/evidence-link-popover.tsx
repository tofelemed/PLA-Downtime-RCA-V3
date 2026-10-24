import { useId } from 'react';
import type { RcaEvidenceItem } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface EvidenceLinkPopoverProps {
  /** node or event the evidence supports */
  targetId: string;
  targetName: string;
  evidence: readonly RcaEvidenceItem[];
  disabled?: boolean;
  onToggle: (evidenceId: string, linked: boolean) => void;
}

/** Picks the evidence items that support a node or event (the link is stored on the evidence item); Esc closes. */
export function EvidenceLinkPopover({ targetId, targetName, evidence, disabled, onToggle }: EvidenceLinkPopoverProps) {
  const titleId = useId();
  const linked = evidence.filter((item) => item.nodeIds.includes(targetId)).length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline" disabled={disabled} aria-label={`Link evidence to ${targetName}`}>
          Evidence ({linked})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="end" role="dialog" aria-labelledby={titleId}>
        <h3 id={titleId} className="text-sm font-semibold text-heading">
          Evidence supporting {targetName}
        </h3>
        {evidence.length === 0 ? (
          <p className="text-sm text-muted-foreground">No evidence yet. Add it on the Evidence page.</p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {evidence.map((item) => {
              const id = `link-${targetId}-${item.id}`;
              return (
                <li key={item.id} className="flex items-start gap-2">
                  <Checkbox id={id} checked={item.nodeIds.includes(targetId)} onCheckedChange={(value) => onToggle(item.id, value === true)} />
                  <Label htmlFor={id} className="font-normal leading-snug">
                    {item.title} <span className="whitespace-nowrap text-xs text-muted-foreground">({item.type ?? 'Note'})</span>
                  </Label>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
