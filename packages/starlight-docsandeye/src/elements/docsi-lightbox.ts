/**
 * `<docsi-lightbox>`: a native `<dialog>` that shows one image full size.
 * Created on demand by `<docsi-step>`; nothing is rendered without JavaScript.
 */
export class DocsiLightbox extends HTMLElement {
  #dialog: HTMLDialogElement | undefined;
  #img: HTMLImageElement | undefined;
  #caption: HTMLElement | undefined;

  connectedCallback(): void {
    if (this.#dialog) return;
    const dialog = document.createElement('dialog');
    dialog.className = 'docsi-lightbox-dialog';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'docsi-lightbox-close';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';
    close.addEventListener('click', () => this.close());

    const figure = document.createElement('figure');
    const img = document.createElement('img');
    img.alt = '';
    const caption = document.createElement('figcaption');
    figure.append(img, caption);

    dialog.append(close, figure);
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) this.close();
    });
    this.append(dialog);
    this.#dialog = dialog;
    this.#img = img;
    this.#caption = caption;
  }

  open(src: string, alt = ''): void {
    if (!this.#dialog || !this.#img || !this.#caption) return;
    this.#img.src = src;
    this.#img.alt = alt;
    this.#caption.textContent = alt;
    if (!this.#dialog.open) this.#dialog.showModal();
  }

  close(): void {
    this.#dialog?.close();
  }
}

/** Open (creating if needed) the page's single lightbox. */
export function openLightbox(src: string, alt = ''): void {
  let box = document.querySelector<DocsiLightbox>('docsi-lightbox');
  if (!box) {
    box = document.createElement('docsi-lightbox') as DocsiLightbox;
    document.body.append(box);
  }
  if (typeof box.open === 'function') box.open(src, alt);
}
