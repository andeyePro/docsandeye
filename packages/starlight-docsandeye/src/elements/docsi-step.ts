/**
 * `<docsi-step>`: the two-column step layout. Server-rendered and complete
 * without JavaScript; when upgraded, images in the media pane open in the
 * shared `<docsi-lightbox>`.
 */
import { openLightbox } from './docsi-lightbox.ts';

export class DocsiStep extends HTMLElement {
  connectedCallback(): void {
    if (this.hasAttribute('data-enhanced')) return;
    this.setAttribute('data-enhanced', '');
    for (const img of this.querySelectorAll<HTMLImageElement>('.docsi-media img')) {
      if (img.closest('docsi-model')) continue;
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
    }
    this.addEventListener('click', this.handleClick);
    this.addEventListener('keydown', this.handleKeydown);
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this.handleClick);
    this.removeEventListener('keydown', this.handleKeydown);
  }

  private zoomable(target: EventTarget | null): HTMLImageElement | undefined {
    if (!(target instanceof HTMLImageElement)) return undefined;
    if (!target.closest('.docsi-media') || target.closest('a, button, docsi-model')) return undefined;
    return target;
  }

  private handleClick = (event: MouseEvent): void => {
    const img = this.zoomable(event.target);
    if (!img) return;
    event.preventDefault();
    openLightbox(img.currentSrc || img.src, img.alt);
  };

  private handleKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const img = this.zoomable(event.target);
    if (!img) return;
    event.preventDefault();
    openLightbox(img.currentSrc || img.src, img.alt);
  };
}
