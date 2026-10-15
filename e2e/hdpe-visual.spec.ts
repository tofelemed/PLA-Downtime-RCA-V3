import { test, expect } from '@playwright/test';
import { loginViaUI } from './test-utils/auth-helpers';

/** Read-only layout checks against the seeded plant, usable after the final data reset. */
for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
  for (const route of ['/dashboard', '/events', '/planning']) {
    test(`${viewport.name}: ${route} keeps the application shell within the viewport`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await loginViaUI(page, 'jonas.weber@demo.acme.com', 'Persona-2026!demo');
      await page.goto(route);
      await expect(page.locator('main')).toBeVisible();
      await page.waitForLoadState('networkidle');
      const pageWidth = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
      await page.screenshot({ path: test.info().outputPath(`${viewport.name}-${route.slice(1)}.png`), fullPage: true });
      expect(pageWidth.content, 'The page should not force the whole screen to scroll horizontally').toBeLessThanOrEqual(pageWidth.viewport + 1);
      await expect(page.getByRole('button', { name: /^Plant: .*HDPE/ })).toBeVisible();
      const currentPlant = page.getByTestId('plant-current-label');
      await expect(currentPlant).toHaveText('HDPE');
      const labelBox = await currentPlant.boundingBox();
      const labelSize = await currentPlant.evaluate((label) => ({ content: label.scrollWidth, visible: label.clientWidth }));
      const currencyBox = await page.getByTestId('display-currency-toggle').boundingBox();
      expect(labelBox?.width).toBeGreaterThan(25);
      expect(labelSize.content, 'The short HDPE plant name must be fully readable').toBeLessThanOrEqual(labelSize.visible);
      expect(labelBox!.x + labelBox!.width).toBeLessThanOrEqual(currencyBox!.x);
      if (route === '/dashboard') {
        const reconciled = page.getByTestId('dashboard-oee-reconciled-tile');
        const widths = await reconciled.evaluate((tile) => ({
          tile: tile.getBoundingClientRect().width,
          available: tile.parentElement!.getBoundingClientRect().width,
        }));
        expect(widths.tile, 'The single reconciled OEE tile must use its available card width').toBeGreaterThanOrEqual(widths.available * 0.95);
      }
      if (viewport.name === 'mobile') await page.screenshot({ path: test.info().outputPath(`mobile-${route.slice(1)}-viewport.png`) });
    });
  }
}
