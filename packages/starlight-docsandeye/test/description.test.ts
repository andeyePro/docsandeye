/**
 * Page descriptions (`src/description.ts`): the first always-shown paragraph
 * of a step body as plain text, cut at a word boundary to ≤ 155 characters,
 * and the guide page's "<title>: <N> steps." Pure; no build.
 */
import { describe, expect, it } from 'vitest';
import { DESCRIPTION_MAX, guideDescription, plainText, stepDescription, truncateAtWord } from '../src/description.ts';

describe('stepDescription', () => {
  it('takes the first paragraph only', () => {
    expect(stepDescription('Open the box and lay the parts out.\n\nKeep the bag of spares.')).toBe('Open the box and lay the parts out.');
  });

  it('joins the lines of a wrapped paragraph', () => {
    expect(stepDescription('Uncoil the lead.\nPush the probe\ninto its socket.\n\nNext.')).toBe('Uncoil the lead. Push the probe into its socket.');
  });

  it('strips inline Markdown: links, emphasis, code, images, HTML, escapes', () => {
    const body = 'Tighten the **widgets** *by hand*; see the [torque table](https://x.example/t), `config.ini`, ~~old~~ <kbd>Ctrl</kbd> 2\\*3 snake_case_name ![icon](a.png)';
    expect(stepDescription(body)).toBe('Tighten the widgets by hand; see the torque table, config.ini, old Ctrl 2*3 snake_case_name');
  });

  it('keeps reference links, autolinks and text directive labels as text', () => {
    expect(plainText('See [the list][bom], <https://a.example/b> and :kbd[Enter]{.k} now.')).toBe('See the list, https://a.example/b and Enter now.');
  });

  it('skips headings, asides, fences, lists, quotes, tables, images and HTML blocks before the first paragraph', () => {
    const body = [
      '# Heading',
      '',
      ':::tip[Sort first]',
      'Lay the widgets out.',
      '',
      'Still inside the aside.',
      ':::',
      '',
      '```sh',
      'echo code',
      '',
      'more code',
      '```',
      '',
      '- a list item',
      '',
      '> a quote',
      '',
      '| a | table |',
      '',
      '![Wiring](wiring.png)',
      '',
      '<a href="x">block</a>',
      '',
      '---',
      '',
      'The real first paragraph.',
    ].join('\n');
    expect(stepDescription(body)).toBe('The real first paragraph.');
  });

  it('drops HTML comments and skips the contents of when blocks', () => {
    const body = '<!-- TODO: a note -->\n<!-- when units>=2 -->\nOnly for several units.\n<!-- /when -->\n\nFor every reader <!-- inline --> here.';
    expect(stepDescription(body)).toBe('For every reader here.');
  });

  it('a multi-line comment is removed whole', () => {
    expect(stepDescription('<!--\nhidden\n\nstill hidden\n-->\nVisible text.')).toBe('Visible text.');
  });

  it('is undefined for a body with no prose paragraph', () => {
    expect(stepDescription('')).toBeUndefined();
    expect(stepDescription(':::note\nOnly an aside.\n:::\n')).toBeUndefined();
    expect(stepDescription('![Only](a.png)\n')).toBeUndefined();
  });

  it('cuts a long paragraph at a word boundary to at most 155 characters', () => {
    const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
    const out = stepDescription(words)!;
    expect(out.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(out.endsWith('…')).toBe(true);
    const kept = out.slice(0, -1);
    expect(words.startsWith(`${kept} `)).toBe(true);
    // The next word would not have fitted.
    const nextWord = words.slice(kept.length + 1).split(' ')[0]!;
    expect(`${kept} ${nextWord}…`.length).toBeGreaterThan(DESCRIPTION_MAX);
  });

  it('counts the stripped text, not the Markdown, against the limit', () => {
    const text = 'a'.repeat(150);
    expect(stepDescription(`[${text}](https://very.long.example/${'x'.repeat(200)})`)).toBe(text);
  });
});

describe('truncateAtWord', () => {
  it('leaves text that fits untouched, including exactly max characters', () => {
    expect(truncateAtWord('short')).toBe('short');
    const exact = `${'a'.repeat(DESCRIPTION_MAX - 2)} b`;
    expect(truncateAtWord(exact)).toBe(exact);
  });

  it('drops trailing punctuation before the ellipsis', () => {
    expect(truncateAtWord('one two, three four', 13)).toBe('one two…');
  });

  it('cuts a single over-long word mid-word', () => {
    expect(truncateAtWord('abcdefghij', 5)).toBe('abcd…');
  });

  it('uses the whole room when a word ends exactly at the limit', () => {
    expect(truncateAtWord('abc def ghi', 8)).toBe('abc def…');
  });
});

describe('guideDescription', () => {
  it('is "<title>: <N> steps."', () => {
    expect(guideDescription('Kit guide', 4)).toBe('Kit guide: 4 steps.');
    expect(guideDescription('Kit guide', 0)).toBe('Kit guide: 0 steps.');
  });

  it('is singular for one step', () => {
    expect(guideDescription('Other guide', 1)).toBe('Other guide: 1 step.');
  });
});
