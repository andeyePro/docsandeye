/**
 * The single client entry: registers the Docs&I custom elements. The server
 * renders complete, legible markup; these elements only upgrade it.
 */
import { DocsiLightbox } from './docsi-lightbox.ts';
import { DocsiModel } from './docsi-model.ts';
import { DocsiStep } from './docsi-step.ts';

if (!customElements.get('docsi-step')) customElements.define('docsi-step', DocsiStep);
if (!customElements.get('docsi-model')) customElements.define('docsi-model', DocsiModel);
if (!customElements.get('docsi-lightbox')) customElements.define('docsi-lightbox', DocsiLightbox);
