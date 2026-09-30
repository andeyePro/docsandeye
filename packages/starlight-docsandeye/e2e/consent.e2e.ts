import { expect, test, type Page } from '@playwright/test';
import { STEP, openReady } from './helpers.ts';

const bar = (page: Page) => page.locator('.docsi-consent-bar');
// The first check a reader can see (one inside a hidden "Only if" block is not).
// It is a yes/no check (the fixture) or a multiple-choice one (a real guide such as the AEP's):
// the answer control is its "Yes" radio or its first option button, whichever it has.
const firstCheck = (page: Page) => page.locator('[data-check]:visible').first();
const answer = async (page: Page) => {
  const yes = firstCheck(page).getByLabel('Yes');
  return (await yes.count()) ? yes : firstCheck(page).locator('button.docsi-check-option').first();
};
const pick = async (page: Page) => {
  const control = await answer(page);
  if ((await control.getAttribute('type')) === 'radio') await control.check();
  else await control.click();
};
const expectPicked = async (page: Page, picked: boolean) => {
  const control = await answer(page);
  if ((await control.getAttribute('type')) === 'radio') await (picked ? expect(control).toBeChecked() : expect(control).not.toBeChecked());
  else await expect(control).toHaveAttribute('aria-pressed', picked ? 'true' : 'false');
};

test('the consent bar waits for the first change; "Save" keeps the answer across a reload', async ({ page }) => {
  await openReady(page, STEP);
  await expect(bar(page)).toBeHidden();

  await pick(page);
  await expect(bar(page)).toBeVisible();

  await bar(page).getByRole('button', { name: 'Save', exact: true }).click();
  await expect(bar(page)).toBeHidden();

  await page.reload();
  await expect(page.locator('[data-enhanced]').first()).toBeAttached();
  await expectPicked(page, true);
  await expect(bar(page)).toBeHidden();
});

test('"Don\'t save" shows the not-saved notice and writes nothing', async ({ page }) => {
  await openReady(page, STEP);
  await pick(page);
  await expect(bar(page)).toBeVisible();

  await bar(page).getByRole('button', { name: "Don't save" }).click();
  await expect(bar(page)).toBeHidden();
  await expect(page.locator('.docsi-consent-notice').first()).toBeVisible();
  await expect(page.locator('.docsi-consent-notice').first()).toContainText('Not saved');
  // Nothing of ours is written; the theme switcher keeps its own keys regardless.
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('docsandeye:')))).toEqual([]);

  await page.reload();
  await expect(page.locator('[data-enhanced]').first()).toBeAttached();
  await expectPicked(page, false);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('docsandeye:')))).toEqual([]);
});
