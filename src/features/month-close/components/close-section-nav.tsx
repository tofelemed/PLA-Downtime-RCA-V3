import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CLOSE_SECTIONS } from '../model/close-section';

/** Views of the same monthly close; Radix supplies roving keyboard focus and panel relationships. */
export function CloseSectionNav() {
  return (
    <TabsList aria-label="Month close sections" className="h-auto w-full flex-wrap justify-start gap-1">
      {CLOSE_SECTIONS.map(({ value, label }) => <TabsTrigger key={value} value={value}>{label}</TabsTrigger>)}
    </TabsList>
  );
}
