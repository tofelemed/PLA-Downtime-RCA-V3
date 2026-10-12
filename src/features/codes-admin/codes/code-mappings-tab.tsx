import { useCapabilities } from '@/features/auth/use-capabilities';
import { Section } from '@/features/ux-kit/page-layout';
import { MappingPreview } from './mapping-preview';
import { MappingRuleForm } from './mapping-rule-form';
import { MappingRulesTable } from './mapping-rules-table';

/**
 * Default mappings of a reason code (spec §3.2): versioned defaults for schedule class, OEE component
 * and impact code, their history, and what the defaults would change on recent events.
 */
export function CodeMappingsTab({ reasonId, active }: { reasonId: string; active: boolean }) {
  const { canWriteCodes } = useCapabilities();
  return (
    <div className="space-y-6" data-testid="mapping-rules">
      <Section title="Default mappings" headingLevel={3} description="Each save is the next version; earlier versions stay for past events.">
        <div className="space-y-4">
          {canWriteCodes && active && <MappingRuleForm reasonId={reasonId} />}
          <MappingRulesTable reasonId={reasonId} />
        </div>
      </Section>
      <Section title="Effect on the last 30 days" headingLevel={3} collapsible defaultOpen={false}>
        <MappingPreview codeId={reasonId} />
      </Section>
    </div>
  );
}
