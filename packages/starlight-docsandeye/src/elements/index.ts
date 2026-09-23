/**
 * The single client entry: registers the Docs&I custom elements and starts
 * the condition evaluator. The server renders complete, legible markup;
 * these elements only upgrade it.
 */
import { initConditions } from './conditions.ts';
import { DocsiChecks } from './docsi-checks.ts';
import { DocsiDiff } from './docsi-diff.ts';
import { DocsiLightbox } from './docsi-lightbox.ts';
import { DocsiModel } from './docsi-model.ts';
import { DocsiProfile, DocsiProfileSummary } from './docsi-profile.ts';
import { DocsiReceipt } from './docsi-receipt.ts';
import { DocsiStep } from './docsi-step.ts';
import { DocsiVideo } from './docsi-video.ts';
import { DocsiYoutube } from './docsi-youtube.ts';

if (!customElements.get('docsi-step')) customElements.define('docsi-step', DocsiStep);
if (!customElements.get('docsi-model')) customElements.define('docsi-model', DocsiModel);
if (!customElements.get('docsi-lightbox')) customElements.define('docsi-lightbox', DocsiLightbox);
if (!customElements.get('docsi-video')) customElements.define('docsi-video', DocsiVideo);
if (!customElements.get('docsi-diff')) customElements.define('docsi-diff', DocsiDiff);
if (!customElements.get('docsi-youtube')) customElements.define('docsi-youtube', DocsiYoutube);
if (!customElements.get('docsi-profile')) customElements.define('docsi-profile', DocsiProfile);
if (!customElements.get('docsi-profile-summary')) customElements.define('docsi-profile-summary', DocsiProfileSummary);
if (!customElements.get('docsi-receipt')) customElements.define('docsi-receipt', DocsiReceipt);
if (!customElements.get('docsi-checks')) customElements.define('docsi-checks', DocsiChecks);

initConditions();
