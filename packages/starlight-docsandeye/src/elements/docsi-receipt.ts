/**
 * `<docsi-receipt>`: the "count what you received" checklist. The server
 * renders a readable table of per-unit quantities; upgraded, this element
 * replaces it with the reader's own checklist (quantities multiplied by the
 * unit count, rows filtered by condition and supplier, a "received" input per
 * row, a "have it" check-off at the start of every row) and a "Missing
 * parts" panel with a pre-filled email to the supplier, or supplier links
 * when there is no one to email. A ticked row is never missing; ticking a
 * "Not in your package" row marks it sourced. The maths and the mailto
 * are core's pure functions; this element reads the items from the server's
 * table rows (`readReceiptItems`) and builds DOM.
 */
import {
  STORAGE_KEYS,
  checkoffKey,
  computeReceipt,
  missingParts,
  missingPartsMailto,
  type Contact,
  type Receipt,
  type ReceiptConfig,
  type ReceiptItem,
  type ReceiptRow,
} from '@docsandeye/core/interactive';
import { applyCheckoffs, doneKeys } from './checkoffs.ts';
import { PARTS_EVENT, PROFILE_EVENT, dataJson, loadProfile, pageGuide, pageUrl, profileItems, readRecord, writeStorage } from './store.ts';

const ElementBase = (typeof HTMLElement === 'undefined' ? class {} : HTMLElement) as typeof HTMLElement;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function supplierLink(row: { name: string; supplier?: { name: string; url?: string } }, label: string): HTMLElement {
  if (!row.supplier?.url) return el('span', row.supplier ? `${label} (${row.supplier.name})` : label);
  const a = el('a', label);
  a.href = row.supplier.url;
  a.rel = 'noopener';
  return a;
}

/** The receipt items the server wrote into the no-JavaScript table rows. */
export function readReceiptItems(root: ParentNode): ReceiptItem[] {
  const items: ReceiptItem[] = [];
  for (const tr of root.querySelectorAll<HTMLElement>('.docsi-receipt-static tr[data-component]')) {
    const d = tr.dataset;
    const item: ReceiptItem = {
      component: d.component!,
      name: tr.querySelector('.docsi-receipt-name')?.textContent ?? d.component!,
      per: d.per === 'kit' ? 'kit' : 'unit',
      qty: Number(d.qty) || 1,
    };
    if (d.from !== undefined) item.from = d.from.split(' ').filter(Boolean);
    if (d.when !== undefined) item.when = dataJson(tr, 'when', {});
    const noteEl = tr.querySelector('.docsi-receipt-note')?.cloneNode(true) as Element | undefined;
    for (const tip of noteEl?.querySelectorAll('.docsi-term-tip') ?? []) tip.remove();
    const note = noteEl?.textContent;
    if (note) item.note = note;
    if (d.supplierName !== undefined) {
      item.supplier = { name: d.supplierName };
      if (d.supplierUrl !== undefined) item.supplier.url = d.supplierUrl;
    }
    items.push(item);
  }
  return items;
}

/**
 * The server's note elements by component, taken out of the (then hidden)
 * table so the live rows show them with their glossary term buttons, and
 * every term id stays unique on the page.
 */
export function takeReceiptNotes(root: ParentNode): Map<string, Element> {
  const notes = new Map<string, Element>();
  for (const tr of root.querySelectorAll<HTMLElement>('.docsi-receipt-static tr[data-component]')) {
    const note = tr.querySelector('.docsi-receipt-note');
    if (note) {
      notes.set(tr.dataset.component!, note);
      note.remove();
    }
  }
  return notes;
}

export class DocsiReceipt extends ElementBase {
  private items: ReceiptItem[] = [];
  private notes = new Map<string, Element>();

  private guideId = '';
  private stepId = '';
  private receipt: Receipt | undefined;

  connectedCallback(): void {
    if (this.hasAttribute('data-enhanced')) return;
    this.setAttribute('data-enhanced', '');
    this.guideId = this.dataset.guide ?? pageGuide() ?? '';
    this.stepId = this.dataset.step ?? '';
    const live = this.querySelector<HTMLElement>('.docsi-receipt-live');
    const staticView = this.querySelector<HTMLElement>('.docsi-receipt-static');
    if (!live || !this.guideId) return;
    this.items = readReceiptItems(this);
    this.notes = takeReceiptNotes(this);
    this.render(live);
    live.hidden = false;
    if (staticView) staticView.hidden = true;
    document.addEventListener(PROFILE_EVENT, () => this.render(live));
    document.addEventListener(PARTS_EVENT, () => this.renderMissing(live));
    live.addEventListener('input', (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || !input.dataset.component) return;
      const received = readRecord(STORAGE_KEYS.receipt(this.guideId));
      const n = Number(input.value);
      if (input.value.trim() === '' || !Number.isFinite(n)) delete received[input.dataset.component];
      else received[input.dataset.component] = Math.max(0, Math.floor(n));
      writeStorage(STORAGE_KEYS.receipt(this.guideId), JSON.stringify(received));
      this.renderMissing(live);
    });
  }

  private render(live: HTMLElement): void {
    const items = profileItems();
    const profile = loadProfile(this.guideId, items);
    const config = dataJson<ReceiptConfig>(this, 'config', {});
    this.receipt = computeReceipt(this.items, profile, config);
    const received = readRecord(STORAGE_KEYS.receipt(this.guideId));
    const labels = dataJson<Record<string, string>>(this, 'supplier-labels', {});
    const r = this.receipt;
    const elsewhereOpen = live.querySelector<HTMLDetailsElement>('.docsi-receipt-elsewhere')?.open ?? false;

    live.replaceChildren();
    const from = r.supplier !== undefined ? ` · ${labels[r.supplier] ?? r.supplier}` : '';
    live.append(el('p', `For ${r.units} ${r.units === 1 ? 'unit' : 'units'}${from}. Count each part and correct the number you received.`, 'docsi-receipt-intro'));
    this.table(live, 'Per unit', r.perUnit, received);
    this.table(live, 'Per kit (does not scale with units)', r.perKit, received);
    if (r.elsewhere.length > 0) {
      // Closed by default: on a phone the list would otherwise push the rest of the step far down.
      const details = el('details', undefined, 'docsi-receipt-elsewhere');
      details.open = elsewhereOpen;
      details.append(el('summary', `Not in your package — source these yourself (${r.elsewhere.length})`));
      const ul = el('ul');
      for (const row of r.elsewhere) {
        const li = el('li');
        li.append(this.checkoff(row, 'Sourced'), `${row.expected} × `, supplierLink(row, row.name));
        const note = this.note(row);
        if (note) li.append(note);
        ul.append(li);
      }
      details.append(ul);
      live.append(details);
    }
    live.append(el('div', undefined, 'docsi-missing'));
    applyCheckoffs(live, this.guideId);
    this.renderMissing(live);
  }

  /** The row's note: the server's element (with its term buttons) when there is one. */
  private note(row: ReceiptRow): Element | undefined {
    return this.notes.get(row.component) ?? (row.note ? el('span', row.note, 'docsi-receipt-note') : undefined);
  }

  /** The "have it" box of a row (state and row marking come from `applyCheckoffs`). */
  private checkoff(row: ReceiptRow, verb: string): HTMLInputElement {
    const box = el('input', undefined, 'docsi-checkoff');
    box.type = 'checkbox';
    box.dataset.checkoff = checkoffKey(this.stepId, row.component);
    box.setAttribute('aria-label', `${verb}: ${row.name}`);
    return box;
  }

  private table(live: HTMLElement, caption: string, rows: readonly ReceiptRow[], received: Record<string, unknown>): void {
    if (rows.length === 0) return;
    const table = el('table', undefined, 'docsi-receipt-table');
    table.append(el('caption', caption));
    const head = el('tr');
    for (const h of ['Have it', 'Part', 'Expected', 'Received']) head.append(el('th', h));
    const thead = el('thead');
    thead.append(head);
    table.append(thead);
    const body = el('tbody');
    for (const row of rows) {
      const tr = el('tr');
      tr.dataset.component = row.component;
      const name = el('td', row.name, 'docsi-receipt-part');
      const note = this.note(row);
      if (note) name.append(note);
      const input = el('input');
      input.type = 'number';
      input.min = '0';
      input.inputMode = 'numeric';
      input.dataset.component = row.component;
      input.setAttribute('aria-label', `Received: ${row.name}`);
      const got = received[row.component];
      input.value = String(typeof got === 'number' ? got : row.expected);
      const cell = el('td', undefined, 'docsi-receipt-received');
      cell.append(input);
      const have = el('td', undefined, 'docsi-receipt-have');
      have.append(this.checkoff(row, 'Have it'));
      tr.append(have, name, el('td', String(row.expected), 'docsi-receipt-expected'), cell);
      body.append(tr);
    }
    table.append(body);
    live.append(table);
  }

  private renderMissing(live: HTMLElement): void {
    const panel = live.querySelector<HTMLElement>('.docsi-missing');
    if (!panel || !this.receipt) return;
    const done = new Set<string>();
    const keys = doneKeys(this.guideId);
    for (const row of [...this.receipt.perUnit, ...this.receipt.perKit]) if (keys.has(checkoffKey(this.stepId, row.component))) done.add(row.component);
    const missing = missingParts(this.receipt, readRecord(STORAGE_KEYS.receipt(this.guideId)), done);
    panel.replaceChildren();
    panel.hidden = missing.length === 0;
    if (missing.length === 0) return;
    panel.append(el('h3', 'Missing parts'));
    const contacts = dataJson<Record<string, Contact>>(this, 'contacts', {});
    const contact = this.receipt.supplier !== undefined ? contacts[this.receipt.supplier] : undefined;
    const config = dataJson<ReceiptConfig>(this, 'config', {});
    const href = missingPartsMailto({
      contact,
      missing,
      units: config.multiply_by !== undefined ? this.receipt.units : undefined,
      pageUrl: pageUrl(),
    });
    const ul = el('ul');
    for (const m of missing) {
      const li = el('li', `${m.name} × ${m.missing}`);
      if (!href && m.supplierUrl) {
        const a = el('a', 'order');
        a.href = m.supplierUrl;
        a.rel = 'noopener';
        li.append(' — ', a);
      }
      ul.append(li);
    }
    panel.append(ul);
    if (href && contact) {
      const a = el('a', `Email ${contact.name} about the missing parts`, 'docsi-missing-mailto');
      a.href = href;
      const p = el('p');
      p.append(a);
      panel.append(p);
    } else if (contact) {
      panel.append(el('p', `Contact ${contact.name} about the missing parts.`));
    }
  }
}
