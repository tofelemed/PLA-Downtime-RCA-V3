import { RcaWorld } from './rca-world';

interface HistoryPage {
  items: Array<{
    action: string;
    changedFields: string[];
    detail: Record<string, unknown>;
  }>;
  totalCount: number;
}

/**
 * QA L8: the case's History names the evidence item a PATCH removed (`detail.itemChanges`), and every page
 * carries the number of entries of the case.
 */
export async function expectHistoryNamesItems(
  env: RcaWorld,
  caseId: string,
): Promise<void> {
  const page = (await env.get(`rcas/${caseId}/history?limit=1`).expect(200))
    .body as HistoryPage;
  const [count] = await env.rows<{ n: number }>(
    `SELECT count(*)::int AS n FROM audit_log WHERE detail ->> 'caseId' = $1`,
    [caseId],
  );
  expect(page.items).toHaveLength(1);
  expect(page.totalCount).toBe(count.n);
  expect(page.totalCount).toBeGreaterThan(1);
  const [latest] = page.items;
  expect(latest.changedFields).toContain('evidence');
  expect(latest.detail.itemChanges).toEqual({
    evidence: [{ item: 'Vibration trend', change: 'removed', fields: [] }],
  });
}

/**
 * QA L11: the actions list names the policy version of each baseline's thresholds — the one frozen with them,
 * and, for a baseline frozen before the version was stored, the version in force when it was computed.
 */
export async function expectBaselinePolicyVersion(
  env: RcaWorld,
  caseId: string,
  actionId: string,
): Promise<void> {
  type ActionBody = {
    id: string;
    baselinePolicyVersion: number | null;
    baseline: { criteria: { policyVersion?: number } };
  };
  const read = async () =>
    (
      (await env.get(`rcas/${caseId}/actions`).expect(200)).body as ActionBody[]
    ).find((a) => a.id === actionId);
  const frozen = await read();
  expect(frozen?.baseline.criteria.policyVersion).toEqual(expect.any(Number));
  expect(frozen?.baselinePolicyVersion).toBe(
    frozen?.baseline.criteria.policyVersion,
  );
  await env.rows(
    `UPDATE rca_actions SET baseline = baseline #- '{criteria,policyVersion}' WHERE id = $1`,
    [actionId],
  );
  try {
    const older = await read();
    expect(older?.baseline.criteria.policyVersion).toBeUndefined();
    expect(older?.baselinePolicyVersion).toBe(frozen?.baselinePolicyVersion);
  } finally {
    await env.rows(
      `UPDATE rca_actions SET baseline = jsonb_set(baseline, '{criteria,policyVersion}', to_jsonb($2::int)) WHERE id = $1`,
      [actionId, frozen?.baselinePolicyVersion],
    );
  }
}

/**
 * QA M3 (re-test): the outcome's approved loss is valued in the view frozen in the approval snapshots of the
 * periods carrying it (the same view the period shows), named in the basis, with no internal reference.
 */
export async function expectSnapshotBasis(
  env: RcaWorld,
  caseId: string,
  approved: { view: string; basis: string },
): Promise<void> {
  const views = await env.rows<{ view: string | null }>(
    `SELECT DISTINCT s.content -> 'reviewed' -> 'valuation' ->> 'defaultView' AS view
       FROM rca_case_links k
       JOIN loss_lines l ON l.cause_event_id::text = k.target_id AND l.tenant_id = k.tenant_id
       JOIN LATERAL (SELECT ar.id FROM accounting_revisions ar WHERE ar.period_id = l.period_id
                      AND ar.lifecycle = 'approved' ORDER BY ar.revision DESC LIMIT 1) r ON true
       JOIN approval_snapshots s ON s.revision_id = r.id
      WHERE k.rca_id = $1 AND k.link_type = 'event'`,
    [caseId],
  );
  const known = views
    .map((row) => row.view)
    .filter((view): view is string => !!view);
  expect(approved.basis).toMatch(/^Approved plan lines /);
  expect(approved.basis).not.toMatch(/SME|policy default/);
  if (new Set(known).size === 1) {
    expect(approved.view).toBe(known[0]);
    expect(approved.basis).toContain(
      '(the view frozen when the periods were approved)',
    );
  } else {
    expect(approved.basis).not.toContain(
      'frozen when the periods were approved',
    );
  }
}
