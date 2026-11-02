import { afterEach, describe, expect, test } from "vitest";
import { articleHTML, loadSections, pagePath, renderMarkdown, researchIncluded, showTodo, type Section } from "./content-plugin";
import { referenceHref, referenceListHTML } from "../src/lib/references";

const SHOW = process.env.SITE_SHOW_TODO;
afterEach(() => { if (SHOW === undefined) delete process.env.SITE_SHOW_TODO; else process.env.SITE_SHOW_TODO = SHOW; });

describe("Phase 7 routes and citations", () => {
  test("citations in Markdown link to the references page under the base path", () => {
    expect(renderMarkdown("Hibberd et al.<sup>1</sup>", "/oberth-efficiency-atlas/"))
      .toContain('<sup><a href="/oberth-efficiency-atlas/references/#ref-1" aria-label="reference 1">1</a></sup>');
    expect(referenceHref("/", 7)).toBe("/references/#ref-7");
    expect(referenceHref("/repo", 7)).toBe("/repo/references/#ref-7");
  });

  test("the reference list has stable anchors and escapes its text", () => {
    expect(referenceListHTML([{ n: 1, text: "A & B, *Title*" }, { n: 2, text: "`code`" }]))
      .toBe('<ol class="references"><li id="ref-1" value="1">A &amp; B, <i>Title</i></li><li id="ref-2" value="2"><code>code</code></li></ol>');
  });

  test("/research/ is built only when a section is published, unless unfinished content is shown", () => {
    delete process.env.SITE_SHOW_TODO;
    const published = loadSections().some((s) => !s.todo);
    expect(researchIncluded("build")).toBe(published);
    expect(researchIncluded("serve")).toBe(true);
    process.env.SITE_SHOW_TODO = "1";
    expect(showTodo("build")).toBe(true);
    expect(researchIncluded("build")).toBe(true);
  });

  test("one section can be placed on its own, with the section navigation (Phase 9 style page)", () => {
    const sec = (id: string, figure?: string, figN?: number): Section =>
      ({ id, title: `T ${id}`, todo: false, figure, figN, before: "<p>prose</p>", after: "", caption: "<p>cap</p>", notes: "" });
    const kept = [sec("hero", "hero", 1), sec("curve", "universal-curve", 2), sec("question")];
    const out = articleHTML("<!--#section:curve-->|<!--#section:missing-->|<ul><!--#section-nav--></ul>", kept, false);
    expect(out).toContain('<section class="section" id="curve" aria-labelledby="h-curve" data-section><h2 id="h-curve">T curve</h2>');
    expect(out).toContain('<figure class="figure" id="fig-universal-curve" data-figure="universal-curve" data-fig-n="2">');
    expect(out).toContain('|<ul><li><a href="#curve" data-nav="curve">T curve</a></li><li><a href="#question" data-nav="question">T question</a></li></ul>');
    expect(out.split("|")[1]).toBe("");          // a section not kept in this build renders as nothing
  });

  test("a page's path comes from its file under the site root", () => {
    expect(pagePath("/x/site/index.html", "/x/site")).toBe("");
    expect(pagePath("/x/site/research/index.html", "/x/site")).toBe("research/");
    expect(pagePath("/x/site/references/index.html", "/x/site")).toBe("references/");
    expect(pagePath("/x/site/404.html", "/x/site")).toBe("404.html");
  });
});
