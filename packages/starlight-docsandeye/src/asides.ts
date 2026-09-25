/**
 * Starlight asides in step bodies: `:::note`, `:::tip`, `:::caution` and
 * `:::danger`, each with an optional `[title]`, rendered with Starlight's own
 * markup and classes so its aside styles apply unchanged:
 *
 * ```html
 * <aside aria-label="Note" class="starlight-aside starlight-aside--note">
 *   <p class="starlight-aside__title" aria-hidden="true"><svg …class="starlight-aside__icon">…</svg>Note</p>
 *   <div class="starlight-aside__content">…</div>
 * </aside>
 * ```
 *
 * Starlight's own remark plugin is not exported (`@astrojs/starlight/internal`
 * carries only translations and the Expressive Code preprocessor), so this is
 * a small reimplementation on `remark-directive`, as Starlight's is. The icon
 * paths are Starlight's (MIT); a test compares them with the installed
 * Starlight so a change there is noticed. Directives that are not asides
 * (`:x` in running text, `::leaf`) are put back as the text they were written
 * as, from the source.
 */

export const ASIDE_VARIANTS = ['note', 'tip', 'caution', 'danger'] as const;
export type AsideVariant = (typeof ASIDE_VARIANTS)[number];

/** Starlight's default (English) titles. */
export const ASIDE_TITLES: Record<AsideVariant, string> = { note: 'Note', tip: 'Tip', caution: 'Caution', danger: 'Danger' };

/** Starlight's icon name per variant, and the icon's SVG children as Starlight ships them. */
export const ASIDE_ICON_NAMES: Record<AsideVariant, string> = { note: 'information', tip: 'rocket', caution: 'warning', danger: 'error' };
export const ASIDE_ICONS: Record<AsideVariant, string> = {
  note: '<path d="M12 11a1 1 0 0 0-1 1v4a1 1 0 0 0 2 0v-4a1 1 0 0 0-1-1Zm.38-3.92a1 1 0 0 0-.76 0 1 1 0 0 0-.33.21 1.15 1.15 0 0 0-.21.33 1 1 0 0 0 .21 1.09c.097.088.209.16.33.21A1 1 0 0 0 13 8a1.05 1.05 0 0 0-.29-.71 1 1 0 0 0-.33-.21ZM12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16.001A8 8 0 0 1 12 20Z"/>',
  tip: '<path fill-rule="evenodd" d="M1.44 8.855v-.001l3.527-3.516c.34-.344.802-.541 1.285-.548h6.649l.947-.947c3.07-3.07 6.207-3.072 7.62-2.868a1.821 1.821 0 0 1 1.557 1.557c.204 1.413.203 4.55-2.868 7.62l-.946.946v6.649a1.845 1.845 0 0 1-.549 1.286l-3.516 3.528a1.844 1.844 0 0 1-3.11-.944l-.858-4.275-4.52-4.52-2.31-.463-1.964-.394A1.847 1.847 0 0 1 .98 10.693a1.843 1.843 0 0 1 .46-1.838Zm5.379 2.017-3.873-.776L6.32 6.733h4.638l-4.14 4.14Zm8.403-5.655c2.459-2.46 4.856-2.463 5.89-2.33.134 1.035.13 3.432-2.329 5.891l-6.71 6.71-3.561-3.56 6.71-6.711Zm-1.318 15.837-.776-3.873 4.14-4.14v4.639l-3.364 3.374Z" clip-rule="evenodd"/><path d="M9.318 18.345a.972.972 0 0 0-1.86-.561c-.482 1.435-1.687 2.204-2.934 2.619a8.22 8.22 0 0 1-1.23.302c.062-.365.157-.79.303-1.229.415-1.247 1.184-2.452 2.62-2.935a.971.971 0 1 0-.62-1.842c-.12.04-.236.084-.35.13-2.02.828-3.012 2.588-3.493 4.033a10.383 10.383 0 0 0-.51 2.845l-.001.016v.063c0 .536.434.972.97.972H2.24a7.21 7.21 0 0 0 .878-.065c.527-.063 1.248-.19 2.02-.447 1.445-.48 3.205-1.472 4.033-3.494a5.828 5.828 0 0 0 .147-.407Z"/>',
  caution: '<path d="M12 16a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm10.67 1.47-8.05-14a3 3 0 0 0-5.24 0l-8 14A3 3 0 0 0 3.94 22h16.12a3 3 0 0 0 2.61-4.53Zm-1.73 2a1 1 0 0 1-.88.51H3.94a1 1 0 0 1-.88-.51 1 1 0 0 1 0-1l8-14a1 1 0 0 1 1.78 0l8.05 14a1 1 0 0 1 .05 1.02v-.02ZM12 8a1 1 0 0 0-1 1v4a1 1 0 0 0 2 0V9a1 1 0 0 0-1-1Z"/>',
  danger: '<path d="M12 7a1 1 0 0 0-1 1v4a1 1 0 0 0 2 0V8a1 1 0 0 0-1-1Zm0 8a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm9.71-7.44-5.27-5.27a1.05 1.05 0 0 0-.71-.29H8.27a1.05 1.05 0 0 0-.71.29L2.29 7.56a1.05 1.05 0 0 0-.29.71v7.46c.004.265.107.518.29.71l5.27 5.27c.192.183.445.286.71.29h7.46a1.05 1.05 0 0 0 .71-.29l5.27-5.27a1.05 1.05 0 0 0 .29-.71V8.27a1.05 1.05 0 0 0-.29-.71ZM20 15.31 15.31 20H8.69L4 15.31V8.69L8.69 4h6.62L20 8.69v6.62Z"/>',
};

export function isAsideVariant(name: string): name is AsideVariant {
  return (ASIDE_VARIANTS as readonly string[]).includes(name);
}

// Just the mdast shape this module touches (no @types/mdast dependency).
interface MdNode {
  type: string;
  name?: string;
  value?: string;
  children?: MdNode[];
  data?: Record<string, unknown>;
  position?: { start: { offset?: number }; end: { offset?: number } };
}

const ATTR_RE = /([a-z-]+)="([^"]*)"/gi;

/** `<path d="…" fill-rule="evenodd"/>…` → mdast nodes rendered as those SVG elements. */
function iconNodes(svg: string): MdNode[] {
  return [...svg.matchAll(/<path\s+([^>]*?)\/>/g)].map((m) => {
    const props: Record<string, string> = {};
    for (const [, key, value] of m[1]!.matchAll(ATTR_RE)) props[key!.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = value!;
    return { type: 'paragraph', data: { hName: 'path', hProperties: props }, children: [] };
  });
}

function element(tag: string, props: Record<string, unknown>, children: MdNode[]): MdNode {
  return { type: 'paragraph', data: { hName: tag, hProperties: props }, children };
}

function text(node: MdNode): string {
  if (node.value !== undefined) return node.value;
  return (node.children ?? []).map(text).join('');
}

function walk(node: MdNode, visit: (node: MdNode, index: number, parent: MdNode) => void): void {
  const children = node.children ?? [];
  for (let i = 0; i < children.length; i++) {
    visit(children[i]!, i, node);
    walk(children[i]!, visit);
  }
}

/** The remark plugin: needs `remark-directive` before it. */
export function remarkDocsiAsides() {
  return (tree: MdNode, file: { value?: unknown }) => {
    const source = typeof file?.value === 'string' ? file.value : String(file?.value ?? '');
    walk(tree, (node, index, parent) => {
      if (node.type === 'textDirective' || node.type === 'leafDirective') {
        const start = node.position?.start.offset;
        const end = node.position?.end.offset;
        const raw = start !== undefined && end !== undefined ? source.slice(start, end) : `:${node.name ?? ''}`;
        const restored: MdNode = { type: 'text', value: raw };
        parent.children![index] = node.type === 'textDirective' ? restored : { type: 'paragraph', children: [restored] };
        return;
      }
      if (node.type !== 'containerDirective' || !isAsideVariant(node.name ?? '')) return;
      const variant = node.name as AsideVariant;
      const children = [...(node.children ?? [])];
      let title = ASIDE_TITLES[variant];
      let titleNodes: MdNode[] = [{ type: 'text', value: title }];
      const first = children[0];
      if (first?.type === 'paragraph' && first.data && 'directiveLabel' in first.data && (first.children?.length ?? 0) > 0) {
        titleNodes = first.children!;
        title = text(first);
        children.shift();
      }
      parent.children![index] = element('aside', { ariaLabel: title, className: ['starlight-aside', `starlight-aside--${variant}`] }, [
        element('p', { className: ['starlight-aside__title'], ariaHidden: 'true' }, [
          element('svg', { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'currentColor', className: ['starlight-aside__icon'] }, iconNodes(ASIDE_ICONS[variant])),
          ...titleNodes,
        ]),
        element('div', { className: ['starlight-aside__content'] }, children),
      ]);
    });
  };
}

/** Markdown for an aside around `body` (the step's `safety` text becomes `:::danger[Safety]`). */
export function asideMarkdown(variant: AsideVariant, title: string, body: string): string {
  // A fence longer than any run of colons in the body, so the body cannot close it early.
  const longest = Math.max(2, ...[...body.matchAll(/:{3,}/g)].map((m) => m[0].length));
  const fence = ':'.repeat(longest + 1);
  return `${fence}${variant}[${title.replace(/[[\]]/g, '\\$&')}]\n${body}\n${fence}\n`;
}
