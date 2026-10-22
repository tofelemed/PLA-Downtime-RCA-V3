import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { AddDialog, useAddDialog } from '@/features/ux-kit/add-dialog';
import { Section } from '@/features/ux-kit/page-layout';
import { ActionIcon } from '@/lib/icons';
import { MappingPreview } from './mapping-preview';
import { MappingRuleForm } from './mapping-rule-form';
import { MappingRulesTable } from './mapping-rules-table';

/**
 * Default mappings of a reason code (spec §3.2): versioned defaults for schedule class, OEE component
 * and impact code, their history, and what the defaults would change on recent events. "+ Add mapping"
 * (top right of the section) opens the new version's form in a dialog (SETUP_UX_FIXES Phase 4).
 */
export function CodeMappingsTab({ reasonId, active }: { reasonId: string; active: boolean }) {
  const { canWriteCodes } = useCapabilities();
  const add = useAddDialog();
  const canAdd = canWriteCodes && active;
  const addButton = canAdd ? (
    <Button size="sm" onClick={add.open} data-testid="mapping-new">
      <ActionIcon.add aria-hidden="true" />
      Add mapping
    </Button>
  ) : undefined;
  return (
    <div className="space-y-6" data-testid="mapping-rules">
      <Section title="Default mappings" headingLevel={3} description="Each save is the next version; earlier versions stay for past events." actions={addButton}>
        <MappingRulesTable reasonId={reasonId} />
      </Section>
      {canAdd && (
        <AddDialog open={add.isOpen} onOpenChange={add.setOpen} title="Add default mapping" description="Saved as the next version of this mapping." testId="mapping-dialog">
          <MappingRuleForm reasonId={reasonId} onSaved={add.close} />
        </AddDialog>
      )}
      <Section title="Effect on the last 30 days" headingLevel={3} collapsible defaultOpen={false}>
        <MappingPreview codeId={reasonId} />
      </Section>
    </div>
  );
}
