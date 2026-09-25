import { expect, test } from '@playwright/test';
import { STEP1, openReady, setUnits } from './helpers.ts';

test('an option with `implies` hides the implied question and sets it in the summary', async ({ page }) => {
  await openReady(page, STEP1);
  const implied = page.locator('[data-profile-field="temp-kit"]');
  const summary = page.locator('.docsi-profile-summary-text');
  await expect(implied).toBeVisible();
  await expect(summary).toContainText('temperature upgrade: no');

  await page.getByLabel('Full kit (temperature upgrade included)').check();
  await expect(implied).toBeHidden();
  await expect(summary).toContainText('Full kit (temperature upgrade included)');
  await expect(summary).toContainText('temperature upgrade: yes');

  await page.getByLabel('Basic kit').check();
  await expect(implied).toBeHidden();
  await expect(summary).toContainText('temperature upgrade: no');

  await page.getByLabel('Custom build: I will say what I have').check();
  await expect(implied).toBeVisible();
});

test('`when`-conditioned content is hidden and shown live as the profile changes', async ({ page }) => {
  await openReady(page, STEP1);
  // A body block: <!-- when units>=2 -->.
  const several = page.locator('.docsi-body .docsi-when', { hasText: 'Building several units?' });
  await expect(several).toBeHidden();
  await setUnits(page, 2);
  await expect(several).toBeVisible();
  await setUnits(page, 1);
  await expect(several).toBeHidden();

  // A part: the probe is received only with the temperature upgrade (receipt `when: {temp-kit: true}`).
  const probe = page.locator('.docsi-receipt-live tr[data-component="probe"]');
  await expect(probe).toHaveCount(0);
  await page.getByLabel('Do you have the temperature upgrade?').check();
  await expect(probe).toHaveCount(1);
  await page.getByLabel('Do you have the temperature upgrade?').uncheck();
  await expect(probe).toHaveCount(0);
});
