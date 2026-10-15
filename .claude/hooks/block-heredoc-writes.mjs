// PreToolUse hook (Bash, PowerShell): block heredocs and here-strings, except for git commit messages.
//
// Why: CLAUDE.md requires the file-edit tools (Edit/Write) for multi-line edits. Shell heredocs have
// corrupted text before, and the rule slipped three times in Phase 6. One slip was an interpreter heredoc
// (`python - <<'PY'`) that edited a file, which no static check can tell apart from a read-only script, so
// every heredoc is blocked unless its statement is a `git commit` (a commit message is not a file edit).
//
// Input: the hook JSON on stdin ({tool_name, tool_input: {command}}). Exit 2 blocks the call and shows
// stderr to the model; exit 0 allows it. Tests: tests/test_hooks.py.
import { readFileSync } from "node:fs";

const GIT_COMMIT = /(^|[\s;&|(])git(\s+-C\s+("[^"]*"|'[^']*'|\S+))*\s+commit(\s|$)/;

/** Heredocs in a Bash command: `<<DELIM` / `<<-DELIM` (optionally quoted) whose terminator line follows. */
export function bashHeredocs(cmd) {
  const lines = cmd.split(/\r?\n/);
  const found = [];
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const re = /(?<!<)<<(-?)\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2/g;
    let m;
    while ((m = re.exec(lines[i])) !== null) {
      const [, dash, , delim] = m;
      const end = lines.findIndex((l, j) => j > i && (dash ? l.replace(/^\t+/, "") : l).trim() === delim);
      if (end < 0) continue;                       // no terminator: a literal "<<" (e.g. inside quotes)
      found.push({ line: i, at: offset + m.index, prefix: statementPrefix(lines[i].slice(0, m.index), lines, i) });
    }
    offset += lines[i].length + 1;
  }
  return found;
}

/** PowerShell here-strings: a line ending in @' or @" (the body follows until '@ or "@). */
export function powershellHereStrings(cmd) {
  const lines = cmd.split(/\r?\n/);
  const found = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /@(['"])\s*$/.exec(lines[i]);
    if (!m) continue;
    const close = m[1] + "@";
    if (!lines.slice(i + 1).some((l) => l.trimStart().startsWith(close))) continue;
    found.push({ line: i, prefix: statementPrefix(lines[i].slice(0, m.index), lines, i) });
  }
  return found;
}

/** Text of the statement before the operator: back to the last top-level separator on this line, or the
 *  previous line when this one continues it (trailing backslash or backtick). */
function statementPrefix(before, lines, i) {
  let text = before;
  for (let j = i - 1; j >= 0 && /[\\`]\s*$/.test(lines[j]); j--) text = lines[j] + " " + text;
  const parts = text.split(/;|&&|\|\||\n/);
  return parts[parts.length - 1];
}

export function decide(input) {
  const name = input.tool_name;
  const cmd = input.tool_input?.command ?? "";
  if (name !== "Bash" && name !== "PowerShell") return { block: false };
  const hits = name === "Bash" ? bashHeredocs(cmd) : powershellHereStrings(cmd);
  const bad = hits.filter((h) => !GIT_COMMIT.test(h.prefix));
  if (!bad.length) return { block: false };
  const kind = name === "Bash" ? "heredoc" : "here-string";
  return {
    block: true,
    reason:
      `Blocked by .claude/hooks/block-heredoc-writes.mjs: this command uses a ${kind} outside a git commit message ` +
      `(statement: "${bad[0].prefix.trim().slice(0, 80)}"). CLAUDE.md requires the Edit or Write tool for ` +
      `multi-line file edits. To run a multi-line script, write it to a file with Write and run the file.`,
  };
}

// Run as a hook (not when imported by a test).
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    process.exit(0);                                // unreadable input: do not get in the way
  }
  const d = decide(input);
  if (d.block) {
    process.stderr.write(d.reason + "\n");
    process.exit(2);
  }
  process.exit(0);
}
