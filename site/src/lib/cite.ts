// Citations and source links: "Hibberd et al.¹" (paper-outline numbering) and a link to the data file
// in the repository at the tag (or commit) the export recorded.
import { h } from "./dom";
import type { SiteData } from "./data";
import { referenceHref } from "./references";

export { referenceHTML } from "./references";

/** Short name plus a superscript reference number linking to the references page. */
export function citation(label: string, ref: number | null): HTMLElement {
  const el = h("span", { class: "cite" }, label);
  if (ref !== null) el.append(h("sup", {}, h("a", { href: referenceHref(import.meta.env.BASE_URL, ref), "aria-label": `reference ${ref}` }, String(ref))));
  return el;
}

/** Link to a source file in the repository (GitHub blob at the recorded ref). */
export function sourceLink(site: SiteData, rel: string): HTMLAnchorElement {
  const ref = site.source_links[rel] ?? site.repo.tag;
  return h("a", { href: `${site.repo.url}/blob/${ref}/${rel}`, rel: "noopener" }, h("code", {}, rel.split("/").pop() ?? rel));   // file names as code
}
