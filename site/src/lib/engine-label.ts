// Names for an engine from the animation's case title (figures/anim_numbers.json via the site data), shared by the
// hero's Π axis and the engines figure, so both say the same thing. A title reads "Name: details\n(note)"; the note
// is either a caveat ("(hypothetical at 3.2 R☉)") or an identifying note ("(Hibberd et al. 2026 reference)").
// Short names on narrow screens (author, 2026-10-19 and 2026-10-20): the first word, starred when there is a caveat,
// with the star explained by `starNote`, built from the same caveat string.

export interface EngineLabel {
  head: string;       // the first line: "SEP-class: Isp 6000 s, a0 = 3.3e-3 m/s²"
  name: string;       // "SEP-class"
  details: string;    // "Isp 6000 s, a0 = 3.3e-3 m/s²"
  note: string;       // "(hypothetical at 3.2 R☉)", or "" without a second line
  caveat: string;     // "hypothetical at 3.2 R☉" when the note is a caveat, else ""
  short: string;      // "Solid", "Nuclear", "SEP*"
  starNote: string;   // "* hypothetical at 3.2 R☉", or "" without a caveat
}

export function engineLabel(title: string): EngineLabel {
  const [head, note = ""] = title.split("\n");
  const [name, details = ""] = head.split(": ");
  const caveat = /hypothetical/.test(note) ? note.replace(/^\(|\)$/g, "") : "";
  return { head, name, details, note, caveat,
           short: name.split(/[\s-]/)[0] + (caveat ? "*" : ""), starNote: caveat ? `* ${caveat}` : "" };
}
