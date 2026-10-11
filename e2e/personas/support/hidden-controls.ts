import { expect, type Locator } from '@playwright/test';

/**
 * Assertions for the capability-gated v2 controls (src/features/auth/capabilities.ts, ux-kit/approve-button):
 * a control the role can only be refused on is not rendered; an approve control offered to the author of
 * the draft is disabled with the separation-of-duties tooltip. The server stays the authority, so every
 * UI assertion is paired with an API call that must still be refused (`expectRefused`).
 */
export const SOD_HINT = 'You authored this: another approver must approve it (separation of duties).';

/** The control is not in the DOM at all (hidden by capability, not merely disabled). */
export async function expectHidden(control: Locator): Promise<void> {
  await expect(control).toHaveCount(0);
}

/** The author's approve control: rendered, disabled, marked `data-sod` and wrapped with the SoD reason. */
export async function expectSodDisabled(control: Locator): Promise<void> {
  await expect(control).toBeVisible();
  await expect(control).toBeDisabled();
  await expect(control).toHaveAttribute('data-sod', 'true');
  const wrapper = control.locator('xpath=ancestor::span[@data-testid="sod-disabled"][1]');
  await expect(wrapper).toHaveAttribute('title', SOD_HINT);
}

/** The server's refusal of a write the UI no longer offers: 403 with the expected machine code. */
export function expectRefused(result: { status: number; body: unknown }, code: string): void {
  const body = (result.body ?? {}) as { code?: string };
  expect([result.status, body.code], JSON.stringify(result.body)).toEqual([403, code]);
}
