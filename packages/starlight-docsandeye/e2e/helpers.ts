/**
 * Shared paths and helpers for the end-to-end suite. By default pages and
 * expected values come from `fixtures/project-interactive` and its site
 * config. With `E2E_DIST` set the suite runs against that built Docs&I site
 * instead: `E2E_GUIDE`, `E2E_STEP` and `E2E_SEARCH` name its pages and a
 * search term, and the fixture-specific tests skip themselves (`fixtureOnly`).
 */
import { expect, test, type Page } from '@playwright/test';

/** True when the suite runs against an external built site (`E2E_DIST`), not the fixture. */
export const EXTERNAL = Boolean(process.env.E2E_DIST);

export const SITE_TITLE = 'Docs&I interactive fixture';
export const STEP1 = '/kit/step-01-unpack/';
export const STEP2 = '/kit/step-02-probe/';
export const STEP3 = '/kit/step-03-finish/';
export const STEP4 = '/kit/step-04-unclosed/';

/** The guide page (`E2E_GUIDE`, default the fixture's `/kit/`). */
export const GUIDE = process.env.E2E_GUIDE || '/kit/';
/** A step page with a glossary term, checks and a receipt (`E2E_STEP`, default the fixture's first step). */
export const STEP = process.env.E2E_STEP || STEP1;
/** A term Pagefind finds on some page (`E2E_SEARCH`, default a glossary term of the fixture). */
export const SEARCH = process.env.E2E_SEARCH || 'tray';

/** Skip the current test (or describe block) against an external site: it asserts fixture content. */
export function fixtureOnly(): void {
  test.skip(EXTERNAL, 'fixture-specific: skipped with E2E_DIST');
}

/** Open a page and wait until its Docs&I client script has upgraded the markup. */
export async function openReady(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator('[data-enhanced]').first()).toBeAttached();
}

/** Set a number answer in the profile form (fires `change`, as leaving the field does); `units` by default. */
export async function setUnits(page: Page, units: number, field = 'units'): Promise<void> {
  let input = page.locator(`#docsi-profile-${field}`);
  if ((await input.count()) === 0) {
    // A site may keep the form on the guide page only; answer there and come back (answers are
    // in memory for the visit, so the step page sees them).
    const back = page.url();
    await openReady(page, GUIDE);
    input = page.locator(`#docsi-profile-${field}`);
    await input.fill(String(units));
    await input.dispatchEvent('change');
    await page.getByRole('button', { name: 'Save' }).click().catch(() => undefined);
    await openReady(page, back);
    return;
  }
  await input.fill(String(units));
  await input.dispatchEvent('change');
}
