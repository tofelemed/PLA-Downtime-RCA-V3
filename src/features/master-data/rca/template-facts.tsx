import type { RcaTemplateView, VerificationChecklistView } from '../api/master-data-types';
import { VERIFICATION_CHECKLISTS } from '../api/record-resource';
import { useRecordLookup } from '../api/use-record-queries';
import { FactsList } from './facts-list';

/** A template's details for readers and retired templates: name, category, description and its checklists by name. */
export function TemplateFacts({ template }: { template: RcaTemplateView }) {
  const checklists = useRecordLookup<VerificationChecklistView>(VERIFICATION_CHECKLISTS, { status: 'all', sort: 'name' });
  const names = checklists.items.filter((checklist) => template.checklistIds.includes(checklist.id)).map((checklist) => checklist.name);
  return (
    <FactsList
      testId="template-facts"
      facts={[
        { label: 'Name', value: template.name },
        { label: 'Category', value: template.category ?? '—' },
        { label: 'Description', value: template.description || '—' },
        { label: 'Verification checklists', value: names.length ? names.join(', ') : '—' },
      ]}
    />
  );
}
