/**
 * Glossary tips. The server renders each linked term as
 * `<button class="docsi-term" data-tip title aria-describedby>` (the `title`
 * is the tip without JavaScript). This removes the titles and shows one
 * shared popover beside a term: on click or tap (Enter or Space when
 * focused), and after a short hover on pointer devices. Escape, or a click
 * elsewhere, closes it.
 */
let tip: HTMLElement | undefined;
let owner: HTMLElement | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
/** Opened by a click (stays until closed), not by hovering. */
let pinned = false;

function popover(): HTMLElement {
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'docsi-tip';
    tip.setAttribute('role', 'tooltip');
    tip.hidden = true;
    document.body.append(tip);
  }
  return tip;
}

function show(term: HTMLElement, pin: boolean): void {
  const el = popover();
  pinned = pin;
  owner = term;
  el.replaceChildren(term.dataset.tip ?? '');
  if (term.dataset.link) {
    const a = document.createElement('a');
    a.href = term.dataset.link;
    a.textContent = 'Read more';
    el.append(' ', a);
  }
  el.hidden = false;
  const r = term.getBoundingClientRect();
  const width = Math.min(288, document.documentElement.clientWidth - 16);
  el.style.maxWidth = `${width}px`;
  el.style.left = `${Math.max(8, Math.min(r.left, document.documentElement.clientWidth - width - 8)) + scrollX}px`;
  el.style.top = `${r.bottom + scrollY + 6}px`;
  term.setAttribute('aria-expanded', 'true');
}

function hide(): void {
  clearTimeout(timer);
  if (tip) tip.hidden = true;
  owner?.setAttribute('aria-expanded', 'false');
  owner = undefined;
  pinned = false;
}

const termOf = (target: EventTarget | null): HTMLElement | null => (target instanceof Element ? target.closest<HTMLElement>('.docsi-term') : null);

export function initGlossary(doc: Document = document): void {
  for (const term of doc.querySelectorAll('.docsi-term')) term.removeAttribute('title');
  doc.addEventListener('click', (event) => {
    const term = termOf(event.target);
    if (term) {
      if (owner === term && pinned) hide();
      else show(term, true);
    } else if (!tip?.contains(event.target as Node)) hide();
  });
  doc.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && owner) {
      const term = owner;
      hide();
      term.focus();
    }
  });
  if (!matchMedia('(hover: hover)').matches) return;
  doc.addEventListener('mouseover', (event) => {
    const term = termOf(event.target);
    if (term) {
      clearTimeout(timer);
      if (owner !== term) timer = setTimeout(() => show(term, false), 350);
    } else if (tip?.contains(event.target as Node)) clearTimeout(timer);
  });
  doc.addEventListener('mouseout', (event) => {
    if (!pinned && (termOf(event.target) || tip?.contains(event.target as Node))) {
      clearTimeout(timer);
      timer = setTimeout(hide, 300);
    }
  });
}
