/**
 * The two choices of the Revision select (owner-approved Reports redesign, 24 Oct 2026): approved
 * figures only (the default, `approvedOnly=true`), or the approved revision else the open draft
 * (`approvedOnly=false`, URL `approved=0`).
 */
export const REVISION_OPTIONS = {
  approved: 'Approved only',
  shown: 'Provisional',
} as const;
