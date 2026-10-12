/** Plain-language labels and display names (docs/UI_UX_AUDIT.md §6): never show internal values. */
export { humanize, labelOf } from './humanize';
export { ROLE_LABELS, LEGACY_ROLE_LABELS, SCOPE_ROLE_LABELS, roleLabel, roleListLabel, type RoleToken } from './role-labels';
export { POLICY_LABELS, policyLabel, policyVersionsLabel, policyRefsLabel } from './policy-labels';
export { FEATURE_LABELS, featureLabel, featureOffMessage } from './feature-labels';
export * from './event-labels';
export * from './workflow-labels';
export * from './planning-labels';
export * from './integration-labels';
export * from './admin-labels';
export * from './administration-labels';
export * from './master-data-labels';
export { looksLikeRawId, assertNoRawId } from './assert-no-raw-id';
export type { NameResolver } from './name-resolver';
export { useUnitNames } from './use-unit-names';
export { useProductNames } from './use-product-names';
export { useAssetNames } from './use-asset-names';
export { useUserNames } from './use-user-names';
