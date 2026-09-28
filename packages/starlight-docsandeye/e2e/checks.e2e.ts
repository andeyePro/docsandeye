/**
 * task_024 — non-leading multiple-choice checks on the fixture's first step
 * (`laid-out`: three options, one wrong one with a picture): a wrong pick
 * shows its fix and never the right answer, a right pick ticks the check,
 * answers survive a reload once saved, the options work from the keyboard,
 * the page stays axe-clean and fits 390 px, and without JavaScript a closed
 * "Show the answer" holds the answer.
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { STEP1, fixtureOnly, openReady } from './helpers.ts';

const RIGHT = 'In one pile per unit';
const WRONG = 'All in one heap';
const WRONG_FIX = 'Split them into one pile per unit.';

const check = (page: Page) => page.locator('li[data-check="laid-out"]');
const option = (page: Page, label: string) => check(page).getByRole('button', { name: label });
const bar = (page: Page) => page.locator('.docsi-consent-bar');

test.beforeEach(() => fixtureOnly());

test('wrong then right: the fix shows, the answer is not revealed, then a green tick', async ({ page }) => {
  await openReady(page, STEP1);
  const li = check(page);
  await expect(li.locator('button.docsi-check-option')).toHaveCount(3);
  for (const b of await li.locator('button.docsi-check-option').all()) {
    await expect(b).toBeEnabled();
    await expect(b).toHaveAttribute('aria-pressed', 'false');
  }
  await expect(li.locator('details.docsi-check-reveal')).toBeHidden();

  await option(page, WRONG).click();
  await expect(option(page, WRONG)).toHaveAttribute('aria-pressed', 'true');
  await expect(li.locator('.docsi-check-feedback')).toHaveText('Not that one. Look again and pick another.');
  await expect(li.locator('.docsi-check-fix', { hasText: WRONG_FIX })).toBeVisible();
  await expect(li.locator('.docsi-check-contact')).toBeVisible();
  const mailto = decodeURIComponent((await li.locator('.docsi-check-contact a').getAttribute('href'))!);
  expect(mailto).toContain(`My answer: ${WRONG}`);
  // Nothing marks the right option after a wrong pick.
  await expect(li.locator('[data-docsi-right]')).toHaveCount(0);
  await expect(option(page, RIGHT)).toHaveAttribute('aria-pressed', 'false');
  await expect(li).not.toHaveAttribute('data-docsi-right', '');
  await expect(page.locator('.docsi-checks-done')).toBeHidden();

  await option(page, RIGHT).click();
  await expect(li).toHaveAttribute('data-docsi-right', '');
  await expect(option(page, RIGHT)).toHaveAttribute('aria-pressed', 'true');
  await expect(option(page, RIGHT).locator('.docsi-check-mark')).toHaveText('✓');
  await expect(option(page, WRONG)).toHaveAttribute('aria-pressed', 'false');
  await expect(li.locator('.docsi-check-feedback')).toHaveText('Correct');
  await expect(li.locator('.docsi-check-fix', { hasText: WRONG_FIX })).toBeHidden();
  await expect(li.locator('.docsi-check-contact')).toBeHidden();
});

test('a right pick counts like Yes: "Step checked" once every check is right', async ({ page }) => {
  await openReady(page, STEP1);
  for (const id of ['count', 'dry']) await page.locator(`li[data-check="${id}"]`).getByLabel('Yes').check();
  await expect(page.locator('.docsi-checks-done')).toBeHidden();
  await option(page, RIGHT).click();
  await expect(page.locator('.docsi-checks-done')).toBeVisible();
  await option(page, WRONG).click();
  await expect(page.locator('.docsi-checks-done')).toBeHidden();
});

test('answers restore on reload once saved: a wrong pick, then a right one', async ({ page }) => {
  await openReady(page, STEP1);
  await option(page, WRONG).click();
  await bar(page).getByRole('button', { name: 'Save', exact: true }).click();

  await page.reload();
  await expect(page.locator('[data-enhanced]').first()).toBeAttached();
  await expect(option(page, WRONG)).toHaveAttribute('aria-pressed', 'true');
  await expect(check(page).locator('.docsi-check-fix', { hasText: WRONG_FIX })).toBeVisible();
  await expect(check(page).locator('[data-docsi-right]')).toHaveCount(0);

  await option(page, RIGHT).click();
  await page.reload();
  await expect(page.locator('[data-enhanced]').first()).toBeAttached();
  await expect(check(page)).toHaveAttribute('data-docsi-right', '');
  await expect(option(page, RIGHT)).toHaveAttribute('aria-pressed', 'true');
  await expect(check(page).locator('.docsi-check-feedback')).toHaveText('Correct');
});

test('keyboard: Tab reaches each option; Enter and Space pick', async ({ page }) => {
  await openReady(page, STEP1);
  const buttons = check(page).locator('button.docsi-check-option');
  await buttons.first().focus();
  const labels: string[] = [];
  for (let i = 0; i < 3; i++) {
    labels.push((await page.evaluate(() => document.activeElement?.querySelector('.docsi-check-label')?.textContent?.trim())) ?? '');
    if (i < 2) await page.keyboard.press('Tab');
  }
  expect(labels.sort()).toEqual([WRONG, RIGHT, 'Still in the box'].sort());

  await option(page, WRONG).focus();
  await page.keyboard.press('Enter');
  await expect(option(page, WRONG)).toHaveAttribute('aria-pressed', 'true');
  await option(page, RIGHT).focus();
  await page.keyboard.press('Space');
  await expect(check(page)).toHaveAttribute('data-docsi-right', '');
});

test('390 px wide: no horizontal overflow, before and after picking', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openReady(page, STEP1);
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await overflow()).toBeLessThanOrEqual(0);
  const box = await check(page).boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await option(page, WRONG).click();
  expect(await overflow()).toBeLessThanOrEqual(0);
  await option(page, RIGHT).click();
  expect(await overflow()).toBeLessThanOrEqual(0);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`axe after picking, ${colorScheme}`, () => {
    test.use({ colorScheme });
    test('a wrong pick, then a right pick, have no violations', async ({ page }) => {
      await openReady(page, STEP1);
      const scan = async () => {
        const results = await new AxeBuilder({ page }).include('docsi-checks').analyze();
        return results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
      };
      await option(page, WRONG).click();
      expect(await scan()).toEqual([]);
      await option(page, RIGHT).click();
      expect(await scan()).toEqual([]);
    });
  });
}

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('options are listed; a closed "Show the answer" reveals it', async ({ page }) => {
    await page.goto(STEP1);
    const li = check(page);
    await expect(li.locator('button.docsi-check-option')).toHaveCount(3);
    await expect(option(page, WRONG)).toBeVisible();
    await expect(li.getByRole('img', { name: 'Every part in a single heap' })).toBeVisible();
    const reveal = li.locator('details.docsi-check-reveal');
    await expect(reveal).toBeVisible();
    await expect(reveal.getByText(`Answer: ${RIGHT}`)).toBeHidden();
    await reveal.locator('summary').click();
    await expect(reveal.getByText(`Answer: ${RIGHT}`)).toBeVisible();
    await expect(reveal.getByText(WRONG_FIX)).toBeVisible();
  });
});
