// Exported site data (scripts/export_site_data.py → public/data/*.json).

/** A displayed number with its source pointer ("file#/json/pointer"). */
export interface Sourced<T = number> {
  value: T;
  src: string;
}

export interface Provenance {
  git: string;
  generated_by: string;
  sources: Record<string, string>;
}

export interface Reference {
  n: number;
  text: string;
}

export interface SiteData {
  provenance: Provenance;
  repo: { url: string; tag: string };
  references: Reference[];
  source_links: Record<string, string>;
}

const cache = new Map<string, Promise<unknown>>();

export function loadData<T>(name: string): Promise<T> {
  if (!cache.has(name)) {
    const url = `${import.meta.env.BASE_URL}data/${name}`;
    cache.set(name, fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
      return r.json();
    }));
  }
  return cache.get(name) as Promise<T>;
}

/** Fill a {template, fields} description from its sourced values. */
export function fillTemplate(d: { template: string; fields: Record<string, Sourced<number | string>> } | Sourced<string>): string {
  if ("value" in d) return d.value;
  return d.template.replace(/\{(\w+)\}/g, (_, k: string) => String(d.fields[k].value));
}
