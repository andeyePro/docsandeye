/**
 * Shared paths and helpers for the end-to-end suite. Pages and expected
 * values come from `fixtures/project-interactive` and its site config.
 */
import { expect, type Page } from '@playwright/test';

export const SITE_TITLE = 'Docs&I interactive fixture';
export const GUIDE = '/kit/';
export const STEP1 = '/kit/step-01-unpack/';
export const STEP2 = '/kit/step-02-probe/';
export const STEP3 = '/kit/step-03-finish/';
export const STEP4 = '/kit/step-04-unclosed/';

/** Open a page and wait until its Docs&I client script has upgraded the markup. */
export async function openReady(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator('[data-enhanced]').first()).toBeAttached();
}

/** Set the "How many units" answer in the profile form (fires `change`, as leaving the field does). */
export async function setUnits(page: Page, units: number): Promise<void> {
  const input = page.locator('#docsi-profile-units');
  await input.fill(String(units));
  await input.dispatchEvent('change');
}
