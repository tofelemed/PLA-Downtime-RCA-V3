import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { authenticate } from './test-utils/api-helpers';
import { loginViaUI } from './test-utils/auth-helpers';
import { call, command } from './test-utils/downtime-world';

/**
 * SME D13 + integrity item 1 (plans/INTEGRITY_FIXES.md): an operator codes a stop, a supervisor (manager
 * approver, never the person who coded it) verifies it from the event page, and the verification is an
 * immutable event revision by the supervisor (`change_reason` = verification), not a silent stamp.
 * Self-seeding (own unit and reason code of the demo tenant), so it runs in the CI smoke set.
 */
const OPERATOR = { email: 'operator@acme.com', password: 'demo123' };
const MANAGER = { email: 'manager@acme.com', password: 'demo123' };
const MINUTE = 60_000;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

interface Revision {
  kind: string;
  changeReason: string | null;
  actorId: string | null;
}

test.describe('Stop coding verification (SME D13, integrity item 1)', () => {
  let operator = '';
  let managerId = '';
  let stopId = '';

  test.beforeAll(async () => {
    const manager = await authenticate(MANAGER.email, MANAGER.password);
    managerId = (manager.user as { id: string }).id;
    const op = await authenticate(OPERATOR.email, OPERATOR.password);
    operator = op.accessToken;
    const tenantId = (op.user as { tenantId: string }).tenantId;
    const suffix = randomUUID().slice(0, 8);
    const unit = await call<{ id: string }>(manager.accessToken, 'POST', '/units', { name: `E2E D13 ${suffix}`, code: `E2E-D13-${suffix}`, tenantId });
    expect(unit.status, JSON.stringify(unit.body)).toBe(201);
    const reason = await command<{ id: string }>(manager.accessToken, '/v2/reason-codes', { code: `E2E-D13-${suffix}`, name: 'Feeder blockage' });
    expect(reason.status, JSON.stringify(reason.body)).toBe(201);
    const stop = await command<{ id: string }>(operator, '/v2/production-events', {
      unitId: unit.body.id,
      physicalType: 'downtime',
      scheduleClass: 'unplanned',
      startTime: iso(-90 * MINUTE),
      endTime: iso(-60 * MINUTE),
      reasonCodeId: reason.body.id,
    });
    expect(stop.status, JSON.stringify(stop.body)).toBe(201);
    stopId = stop.body.id;
  });

  test('the supervisor verifies the coding on screen and the verification is a revision by the supervisor', async ({ page }) => {
    await loginViaUI(page, MANAGER.email, MANAGER.password);
    await page.goto(`/events/${stopId}`);
    const panel = page.getByTestId('event-verification');
    await expect(panel).toContainText('not verified yet', { timeout: 60_000 });
    await panel.getByTestId('verify-stop').click();
    await expect(panel).toContainText('verified by');
    await expect(panel.getByTestId('verify-stop')).toHaveCount(0);

    const history = await call<{ revisions: Revision[] }>(operator, 'GET', `/v2/production-events/${stopId}/revisions`);
    expect(history.status).toBe(200);
    const verifications = history.body.revisions.filter((revision) => revision.changeReason === 'verification');
    expect(verifications).toHaveLength(1);
    expect(verifications[0]).toMatchObject({ kind: 'user', actorId: managerId });
  });
});
