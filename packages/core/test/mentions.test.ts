import { describe, expect, it } from 'vitest';
import { keyWords, mentionsComponent } from '../src/mentions.js';

describe('mentionsComponent', () => {
  const regulator = { id: 'co2-regulator', name: 'CO₂ regulator' };
  it('matches the whole name or id as words', () => {
    expect(mentionsComponent('Screw the CO₂ regulator on.', regulator)).toBe(true);
    expect(mentionsComponent('Fit the co2 regulator.', regulator)).toBe(true);
  });
  it('accepts a key word of the name, including its plural', () => {
    expect(mentionsComponent('Screw the regulator on.', regulator)).toBe(true);
    expect(mentionsComponent('Fit two vent filters.', { id: 'hydrophobic-vent-filter', name: '0.2 µm hydrophobic vent filters' })).toBe(true);
    expect(mentionsComponent('Put the cylinder in its holder.', { id: 'sodastream-co2-cylinder', name: 'SodaStream CO₂ cylinder (blue screw-in)' })).toBe(true);
  });
  it('ignores sizes, joiners and colours as evidence', () => {
    expect(keyWords('1/4" BSP to 1/8" BSP reducing hexagon nipple')).toEqual(['reducing', 'hexagon', 'nipple']);
    expect(mentionsComponent('A male end goes in.', { id: 'barb-1-16-to-male-luer-lock', name: '1/16" barb to male luer lock' })).toBe(false);
    expect(mentionsComponent('Push the barb in.', { id: 'barb-1-16-to-male-luer-lock', name: '1/16" barb to male luer lock' })).toBe(true);
  });
  it('tolerates a plural on either side', () => {
    expect(mentionsComponent('Fit four 8 mm screws.', { id: 'screw-8mm', name: '8 mm screw' })).toBe(true);
    expect(mentionsComponent('Screw the GL45 cap on.', { id: 'gl45-cap', name: 'GL45 caps' })).toBe(true);
  });

  it('does not match inside another word', () => {
    expect(mentionsComponent('Deregulator is not a word.', regulator)).toBe(false);
  });
});
