/**
 * Minimal ambient typing for `@tgwf/co2` 0.19.0, which ships no `.d.ts`.
 * Only the surface the CLI uses (Sustainable Web Design v4, `perByte`).
 */
declare module '@tgwf/co2' {
  export interface Co2Options {
    model?: 'swd' | '1byte';
    version?: 3 | 4;
    rating?: boolean;
    results?: 'segment';
  }
  export class co2 {
    constructor(options?: Co2Options);
    perByte(bytes: number, green?: boolean): number;
  }
}
