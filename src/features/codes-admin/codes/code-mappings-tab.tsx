import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { RcaCard } from '@/features/rca/components/rca-card';
import { AddDialog, useAddDialog } from '@/features/ux-kit/add-dialog';
import { ActionIcon } from '@/lib/icons';
import { MappingPreview } from './mapping-preview';
import { MappingRuleForm } from './mapping-rule-form';
import { MappingRulesTable } from './mapping-rules-table';

const VERSIONS_INFO = 'Each save is the next version of the mapping; earlier versions stay for past events.';

/**
 * Default mappings of a reason code (spec §3.2): versioned defaults for schedule class, OEE component
 * and impact code, their history, and what the defaults would change on recent events. "+ Add mapping"
 * (top right of the card) opens the new version's form in a dialog (SETUP_UX_FIXES Phase 4).
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
      <RcaCard title="Default mappings" info={VERSIONS_INFO} actions={addButton} testId="mapping-rules-card">
        <MappingRulesTable reasonId={reasonId} />
      </RcaCard>
      {canAdd && (
        <AddDialog
          open={add.isOpen}
          onOpenChange={add.setOpen}
          title="Add default mapping"
          titleAside={<KpiInfo label="default mappings" text={VERSIONS_INFO} />}
          testId="mapping-dialog"
        >
          <MappingRuleForm reasonId={reasonId} onSaved={add.close} onCancel={add.close} />
        </AddDialog>
      )}
      <RcaCard title="Effect on the last 30 days" collapsible testId="mapping-preview-card">
        <MappingPreview codeId={reasonId} />
      </RcaCard>
    </div>
  );
}
