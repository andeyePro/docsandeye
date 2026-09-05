/**
 * `<docsi-diff>`: old and current geometry side by side. The server renders
 * the complete element — one `<figure>` per model, each with its caption and
 * a `<docsi-model>` whose light DOM is a download link — so nothing here is
 * needed to read it. On upgrade the element only adds a layout class
 * (`docsi-diff-single` | `docsi-diff-pair`) that drives the CSS grid.
 * Camera linking is out of scope: `docsi-model` exposes no viewer API.
 *
 * `diffLayout` is pure and unit-tested in Node.
 */

export type DiffLayout = 'single' | 'pair';

/** Grid layout for `count` figures: two (or more) sit side by side, fewer stack. */
export function diffLayout(count: number): DiffLayout {
  return count >= 2 ? 'pair' : 'single';
}

// The class must be importable in Node for the unit test, where there is no HTMLElement to extend.
const ElementBase = (typeof HTMLElement === 'undefined' ? class {} : HTMLElement) as typeof HTMLElement;

export class DocsiDiff extends ElementBase {
  connectedCallback(): void {
    if (this.hasAttribute('data-enhanced')) return;
    this.setAttribute('data-enhanced', '');
    this.classList.add(`docsi-diff-${diffLayout(this.querySelectorAll(':scope > figure').length)}`);
  }
}
