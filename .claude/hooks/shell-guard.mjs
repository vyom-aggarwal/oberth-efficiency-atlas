// PreToolUse hook (Bash, PowerShell): two mechanical guards for project rules (CLAUDE.md, working rules).
//
// 1. Heredocs and here-strings are blocked, except for git commit messages.
//    CLAUDE.md requires the file-edit tools (Edit/Write) for multi-line edits; shell heredocs have corrupted
//    text before, and the rule slipped three times in Phase 6. One slip was an interpreter heredoc
//    (`python - <<'PY'`) that edited a file, which no static check can tell apart from a read-only script, so
//    every heredoc is blocked unless its statement is a `git commit` (a commit message is not a file edit).
// 2. A test run piped into tail, head or grep is blocked unless the command sets pipefail (Bash).
//    Without pipefail a pipeline's exit status is the last command's, so `pytest | tail -1 && git commit`
//    commits even when tests fail; that happened once in Phase 6 (author rule, 2026-10-16).
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
      found.push({ line: i, end, at: offset + m.index, prefix: statementPrefix(lines[i].slice(0, m.index), lines, i) });
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

// ---------------------------------------------------------------- guard 2: test exit codes hidden by a pipe

/** The command with heredoc bodies removed and quoted strings emptied, so their text is never parsed. */
function skeleton(cmd) {
  const lines = cmd.split(/\r?\n/);
  const drop = new Set();
  for (const h of bashHeredocs(cmd)) for (let j = h.line + 1; j <= h.end; j++) drop.add(j);
  return lines.filter((_, i) => !drop.has(i)).join("\n")
    .replace(/'[^']*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
}

/** Is this pipeline segment a test run? Judged by its program, not by words in its arguments. */
export function isTestCommand(segment) {
  const words = segment.trim().replace(/^\(+/, "").split(/\s+/).filter((w) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(w));
  if (!words.length) return false;
  const prog = words[0].replace(/\\/g, "/").split("/").pop().replace(/\.exe$/i, "");
  const rest = words.slice(1);
  if (prog === "pytest" || prog === "py.test" || prog === "vitest") return true;
  if (/^python(3(\.\d+)?)?$/.test(prog) || prog === "py") {
    const i = rest.indexOf("-m");
    return i >= 0 && ["pytest", "vitest"].includes(rest[i + 1]);
  }
  if (prog === "npx") {
    const tool = rest.find((w) => !w.startsWith("-"));
    return tool === "vitest" || (tool === "playwright" && rest.includes("test"));
  }
  if (prog === "playwright") return rest[0] === "test";
  if (prog === "npm" || prog === "pnpm" || prog === "yarn") {
    const args = rest.filter((w, k) => !w.startsWith("-") && !(rest[k - 1] === "--prefix"));
    if (args[0] === "test" || args[0] === "t") return true;
    return args[0] === "run" && ["test", "e2e"].includes(args[1]);
  }
  return false;
}

const FILTER = /^\s*(tail|head|grep|egrep|fgrep)(\s|$)/;
const SETS_PIPEFAIL = /^\s*set\s+(-[A-Za-z]+\s+)*-[A-Za-z]*o\s+pipefail\b/;   // set -o pipefail, set -euo pipefail, ...

/** Pipelines in which a test command's output goes into tail, head or grep, with no pipefail set before them. */
export function maskedTestPipes(cmd) {
  const hits = [];
  let pipefail = false;
  for (const statement of skeleton(cmd).split(/\n|;|&&|\|\|/)) {
    if (SETS_PIPEFAIL.test(statement)) { pipefail = true; continue; }
    if (pipefail) continue;
    const segs = statement.split("|");
    for (let i = 0; i + 1 < segs.length; i++) {
      if (isTestCommand(segs[i].replace(/\$\(/g, " ")) && segs.slice(i + 1).some((s) => FILTER.test(s))) {
        hits.push(statement.trim());
        break;
      }
    }
  }
  return hits;
}

// ---------------------------------------------------------------- decision

export function decide(input) {
  const name = input.tool_name;
  const cmd = input.tool_input?.command ?? "";
  if (name !== "Bash" && name !== "PowerShell") return { block: false };
  const hits = name === "Bash" ? bashHeredocs(cmd) : powershellHereStrings(cmd);
  const bad = hits.filter((h) => !GIT_COMMIT.test(h.prefix));
  if (bad.length) {
    const kind = name === "Bash" ? "heredoc" : "here-string";
    return {
      block: true,
      reason:
        `Blocked by .claude/hooks/shell-guard.mjs: this command uses a ${kind} outside a git commit message ` +
        `(statement: "${bad[0].prefix.trim().slice(0, 80)}"). CLAUDE.md requires the Edit or Write tool for ` +
        `multi-line file edits. To run a multi-line script, write it to a file with Write and run the file.`,
    };
  }
  if (name === "Bash") {
    const masked = maskedTestPipes(cmd);
    if (masked.length) {
      return {
        block: true,
        reason:
          `Blocked by .claude/hooks/shell-guard.mjs: a test command is piped into tail/head/grep without pipefail ` +
          `("${masked[0].slice(0, 90)}"), so its exit status would be hidden and a following && would run even if ` +
          `tests fail. Start the command with "set -o pipefail;" (or do not pipe the test output).`,
      };
    }
  }
  return { block: false };
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
