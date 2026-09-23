/**
 * The guide index page's client entry: the profile form and the condition
 * evaluator only. Kept apart from `index.ts` so step pages keep a single
 * registering script (shared modules become a common chunk).
 */
import { initConditions } from './conditions.ts';
import { DocsiProfile, DocsiProfileSummary } from './docsi-profile.ts';

if (!customElements.get('docsi-profile')) customElements.define('docsi-profile', DocsiProfile);
if (!customElements.get('docsi-profile-summary')) customElements.define('docsi-profile-summary', DocsiProfileSummary);

initConditions();
