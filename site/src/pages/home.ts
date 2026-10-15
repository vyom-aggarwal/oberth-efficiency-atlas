// The home page: the shell, the sticky section navigation, and the figures, each loaded when it nears the
// viewport (data for figures below the fold is lazy-loaded with its code).
import { initShell } from "./shell";
import { loadData, type SiteData } from "../lib/data";
import { h } from "../lib/dom";
import { referenceHTML } from "../lib/cite";
import { sig } from "../lib/format";

initShell("home");

// ---------------------------------------------------------------- section navigation
const links = new Map<string, HTMLAnchorElement[]>();
for (const a of document.querySelectorAll<HTMLAnchorElement>("[data-nav]")) {
  const id = a.dataset.nav!;
  links.set(id, [...(links.get(id) ?? []), a]);
}
const currentLabel = document.querySelector<HTMLElement>("[data-current-section]");
const mobileNav = document.querySelector<HTMLDetailsElement>(".section-nav-mobile");
function setCurrent(id: string): void {
  for (const [key, anchors] of links) for (const a of anchors) {
    if (key === id) a.setAttribute("aria-current", "true");
    else a.removeAttribute("aria-current");
  }
  if (currentLabel) currentLabel.textContent = links.get(id)?.[0]?.textContent ?? "";
}
const visible = new Map<string, number>();
const io = new IntersectionObserver((entries) => {
  for (const e of entries) visible.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
  const best = [...visible.entries()].filter(([id, r]) => r > 0 && links.has(id)).sort((a, b) => b[1] - a[1])[0];
  if (best) setCurrent(best[0]);
}, { rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.01, 0.25, 0.5, 1] });
for (const s of document.querySelectorAll<HTMLElement>("section[data-section]")) if (s.id !== "hero") io.observe(s);
mobileNav?.addEventListener("click", (e) => {
  if ((e.target as HTMLElement).closest("a")) mobileNav.open = false;
});

// ---------------------------------------------------------------- figures
type Mount = (body: HTMLElement, figN: number) => Promise<void>;
const FIGURES: Record<string, Mount> = {
  "universal-curve": async (body, figN) => {
    const [{ universalCurve }, site, curve] = await Promise.all([
      import("../charts/universal-curve"), loadData<SiteData>("site.json"), loadData<any>("curve.json")]);
    universalCurve(body, curve, site, { figN, title: "Loss as a fraction of Δv against Π" });
  },
  references: async (body) => {
    const site = await loadData<SiteData>("site.json");
    body.append(h("ol", { class: "references" }, ...site.references.map((r) =>
      h("li", { id: `ref-${r.n}`, value: r.n, html: referenceHTML(r.text) }))));
  },
  methods: async (body) => {
    const [site, m] = await Promise.all([loadData<SiteData>("site.json"), loadData<any>("methods.json")]);
    const row = (k: string, v: Node | string) => h("div", {}, h("dt", {}, k), h("dd", {}, v));
    body.append(h("dl", { class: "facts" },
      row("Analysis tag", h("a", { href: `${site.repo.url}/tree/${m.tag}`, rel: "noopener" }, `${m.tag} (commit ${m.tag_commit})`)),
      row("Tests in the suite", String(m.tests_collected)),
      row("Π²/96 rule, largest ratio for Π ≤ 1", sig(m.rule_max_ratio_Pi_le_1.value, 4)),
      row("J2 oblateness, largest change in η", sig(m.j2_max_abs_delta_eta.value, 2)),
      row("Rebuild and audit", h("a", { href: `${site.repo.url}/blob/main/${m.repro_doc}`, rel: "noopener" }, m.repro_doc))));
  },
};

function placeholder(body: HTMLElement, name: string): void {
  body.append(h("p", { class: "figure-pending" }, `Figure "${name}" is built at a later checkpoint.`));
}

const lazy = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    lazy.unobserve(e.target);
    const fig = e.target as HTMLElement;
    const body = fig.querySelector<HTMLElement>(".figure-body")!;
    const name = fig.dataset.figure!;
    const mount = FIGURES[name];
    if (!mount) {
      if (import.meta.env.DEV) placeholder(body, name);
      continue;
    }
    mount(body, Number(fig.dataset.figN ?? 0)).catch((err) => {
      console.error(err);
      body.append(h("p", { class: "figure-error", role: "alert" }, "This figure could not load its data. Reload the page to try again."));
    });
  }
}, { rootMargin: "600px 0px" });
for (const fig of document.querySelectorAll<HTMLElement>("figure[data-figure]")) lazy.observe(fig);
