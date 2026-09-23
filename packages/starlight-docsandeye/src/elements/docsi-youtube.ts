/**
 * `<docsi-youtube>`: a click-to-load facade for a YouTube clip. The server
 * renders a hidden play button (the authored poster, or a neutral
 * placeholder with the title and duration) and a `<noscript>` link to the
 * watch page, so nothing is requested from YouTube before the reader asks.
 * Upgraded, the button shows; a click replaces it with the privacy-enhanced
 * `youtube-nocookie.com` iframe named in `data-embed`. The version banner
 * and the STALE flow's "Watch the older video" work as for `<docsi-video>`.
 */
import { wireOlderButton } from './docsi-video.ts';

const ElementBase = (typeof HTMLElement === 'undefined' ? class {} : HTMLElement) as typeof HTMLElement;

export const YOUTUBE_ALLOW = 'autoplay; encrypted-media; picture-in-picture; fullscreen';

export class DocsiYoutube extends ElementBase {
  connectedCallback(): void {
    if (this.hasAttribute('data-enhanced')) return;
    this.setAttribute('data-enhanced', '');
    const banner = this.querySelector<HTMLElement>('.docsi-banner');
    if (banner) banner.hidden = false;
    const button = this.querySelector<HTMLButtonElement>('button.docsi-youtube-play');
    const embed = this.dataset.embed;
    if (button && embed) {
      button.hidden = false;
      button.addEventListener(
        'click',
        () => {
          const iframe = document.createElement('iframe');
          iframe.src = embed;
          iframe.title = this.dataset.title ?? 'Video';
          iframe.allow = YOUTUBE_ALLOW;
          iframe.allowFullscreen = true;
          iframe.className = 'docsi-youtube-frame';
          button.replaceWith(iframe);
          iframe.focus();
          this.setAttribute('data-playing', '');
        },
        { once: true },
      );
    }
    wireOlderButton(this);
  }
}
