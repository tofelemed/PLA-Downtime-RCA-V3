import type { FieldVocabulary } from '@/features/ux-kit/errors';

/** How the organization / plant forms name the server's fields in refusals. */
export const HIERARCHY_FIELD_VOCABULARY: FieldVocabulary = {
  code: { label: 'Code' },
  name: { label: 'Name' },
  description: { label: 'Description' },
  timezone: { label: 'Time zone' },
  organizationId: { label: 'Organization' },
};
