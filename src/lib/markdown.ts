// Streaming markdown beautifier (formerly md-format.py).
// Line-anchored regex substitutions applied to one full line at a time.
// Plus a section parser used by wave-memory.

import { colors } from './ansi.js';

const H1 = /^(\s*)# (.+)$/;
const H2 = /^(\s*)## (.+)$/;
const H3 = /^(\s*)### (.+)$/;
const BOLD_PAT = /\*\*([^*]+)\*\*/g;
const INLINE_CODE = /`([^`]+)`/g;
const BULLET = /^(\s*)[-*] (.+)$/;
const ORDERED = /^(\s*)(\d+)\. (.+)$/;

const inlineSubs = (s: string): string => {
  const { BOLD, DIM, RESET } = colors;
  return s
    .replace(BOLD_PAT, (_m, inner: string) => `${BOLD}${inner}${RESET}`)
    .replace(INLINE_CODE, (_m, inner: string) => `${DIM}${inner}${RESET}`);
};

// Transforms a full line (including its trailing newline if any).
// Pass-through with inline substitutions only if no block pattern matches.
export const transformMarkdownLine = (line: string): string => {
  const { BOLD, CYAN, MAGENTA, YELLOW, RESET } = colors;
  let m: RegExpExecArray | null;
  m = H3.exec(line);
  if (m !== null) return `${m[1]}${BOLD}${YELLOW}### ${m[2]}${RESET}\n`;
  m = H2.exec(line);
  if (m !== null) return `${m[1]}${BOLD}${MAGENTA}## ${m[2]}${RESET}\n`;
  m = H1.exec(line);
  if (m !== null) return `${m[1]}${BOLD}${CYAN}# ${m[2]}${RESET}\n`;
  m = BULLET.exec(line);
  if (m !== null) {
    return `${m[1]}${CYAN}•${RESET} ${inlineSubs(m[2] ?? '')}\n`;
  }
  m = ORDERED.exec(line);
  if (m !== null) {
    return `${m[1]}${CYAN}${m[2]}.${RESET} ${inlineSubs(m[3] ?? '')}\n`;
  }
  return inlineSubs(line);
};

// Splits a markdown document on top-level "## SECTION: <name>" markers.
// Returns a map from lowercased section name to its body (trimmed).
export const parseSections = (text: string): Map<string, string> => {
  const out = new Map<string, string>();
  const parts = text.split(/^##\s+SECTION:\s+(\w+)\s*$/m);
  for (let i = 1; i < parts.length; i += 2) {
    const name = (parts[i] ?? '').trim().toLowerCase();
    const body = (parts[i + 1] ?? '').trim();
    out.set(name, body);
  }
  return out;
};
