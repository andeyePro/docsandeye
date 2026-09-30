import { expect, test } from '@playwright/test';
import { STEP, openReady } from './helpers.ts';

test('a glossary term opens its tip from the keyboard and Escape returns focus', async ({ page }) => {
  await openReady(page, STEP);
  // The first term on the page a reader can reach (one inside a hidden "Only if" block is not).
  const term = page.locator('button.docsi-term:visible').first();
  // A real site's step may use no glossary term (the fixture's always does).
  test.skip((await term.count()) === 0, 'no glossary term on this step');
  const tipText = (await term.getAttribute('data-tip'))!;
  expect(tipText).toBeTruthy();

  // Tab through the page until the term has focus.
  for (let i = 0; i < 150 && !(await term.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(term).toBeFocused();

  await page.keyboard.press('Enter');
  const tip = page.locator('.docsi-tip');
  await expect(tip).toBeVisible();
  await expect(tip).toContainText(tipText);
  await expect(term).toHaveAttribute('aria-expanded', 'true');

  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
  await expect(term).toHaveAttribute('aria-expanded', 'false');
  await expect(term).toBeFocused();
});
