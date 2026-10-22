// The reference list lives on its own page, /references/, with stable anchors #ref-1, #ref-2, … (Phase 7). Pure
// functions, shared by the browser (citations in figures) and the content plugin (the page itself, and citations in
// Markdown, built in Node).

/** Where reference n is: the references page under the site's base path. */
export function referenceHref(base: string, n: number | string): string {
  return `${base.replace(/\/?$/, "/")}references/#ref-${n}`;
}

/** A reference-list entry (inline Markdown from docs/paper_outline.md: *italic*, `code`) as safe HTML. */
export function referenceHTML(text: string): string {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.replace(/\*([^*]+)\*/g, "<i>$1</i>").replace(/`([^`]+)`/g, "<code>$1</code>");
}

/** The numbered list, as built into /references/. */
export function referenceListHTML(refs: { n: number; text: string }[]): string {
  return `<ol class="references">${refs.map((r) => `<li id="ref-${r.n}" value="${r.n}">${referenceHTML(r.text)}</li>`).join("")}</ol>`;
}
