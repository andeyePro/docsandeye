/**
 * `<docsi-model data-src="…glb">`: server-rendered with a plain download
 * link as its light-DOM child. When upgraded it offers a "View in 3D" button;
 * the viewer library is fetched only when that button is activated.
 */
const VIEWER_TAG = 'model-viewer';

export class DocsiModel extends HTMLElement {
  #button: HTMLButtonElement | undefined;

  connectedCallback(): void {
    if (this.hasAttribute('data-enhanced')) return;
    this.setAttribute('data-enhanced', '');
    const src = this.dataset.src;
    if (!src) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'docsi-model-load';
    button.textContent = 'View in 3D';
    button.addEventListener('click', () => {
      void this.show(src);
    });
    this.#button = button;
    this.prepend(button);
  }

  async show(src: string): Promise<void> {
    const button = this.#button;
    if (button) {
      button.disabled = true;
      button.textContent = 'Loading 3D viewer…';
    }
    try {
      if (!customElements.get(VIEWER_TAG)) {
        await import('@google/model-viewer/dist/model-viewer.min.js');
      }
    } catch {
      if (button) {
        button.disabled = false;
        button.textContent = 'Viewer failed to load — try again';
      }
      return;
    }
    const viewer = document.createElement(VIEWER_TAG);
    viewer.className = 'docsi-viewer';
    viewer.setAttribute('src', src);
    viewer.setAttribute('alt', this.querySelector('a')?.textContent?.trim() || '3D model');
    viewer.setAttribute('camera-controls', '');
    viewer.setAttribute('touch-action', 'pan-y');
    viewer.setAttribute('shadow-intensity', '1');
    viewer.setAttribute('loading', 'eager');
    button?.remove();
    this.#button = undefined;
    this.prepend(viewer);
    this.setAttribute('data-viewer', 'loaded');
  }
}
