#!/usr/bin/env python3
"""
Lightweight streaming markdown formatter for flow-auto.

Reads stdin line by line, applies inline regex substitutions to add ANSI
colors/styling for a few common markdown patterns, writes to stdout.

Designed to live between `jq` (which extracts text from Pi's JSON event stream)
and the terminal, so the assistant's prose is visually structured.

Supported patterns:
  # H1          → bold cyan
  ## H2         → bold magenta
  ### H3        → bold yellow
  **bold**      → bold
  `inline`     → dim
  - / *  list   → `  • ` (cyan bullet)
  1. ordered    → `  N.` (cyan number)

Out of scope (kept untouched): tables, fenced code blocks, blockquotes, links.

Colors disabled when:
  - NO_COLOR env var is set
  - stdout is not a TTY (e.g. piped to a file)
"""

from __future__ import annotations

import os
import re
import sys

USE_COLOR = (not os.environ.get("NO_COLOR")) and sys.stdout.isatty()

if USE_COLOR:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    CYAN = "\033[36m"
    MAGENTA = "\033[35m"
    YELLOW = "\033[33m"
else:
    RESET = BOLD = DIM = CYAN = MAGENTA = YELLOW = ""

H3 = re.compile(r"^(\s*)### (.+)$")
H2 = re.compile(r"^(\s*)## (.+)$")
H1 = re.compile(r"^(\s*)# (.+)$")
BOLD_RE = re.compile(r"\*\*([^*]+)\*\*")
INLINE_CODE = re.compile(r"`([^`]+)`")
BULLET = re.compile(r"^(\s*)[-*] (.+)$")
ORDERED = re.compile(r"^(\s*)(\d+)\. (.+)$")


def transform(line: str) -> str:
    # Headings first (line-anchored)
    m = H3.match(line)
    if m:
        return f"{m.group(1)}{BOLD}{YELLOW}### {m.group(2)}{RESET}\n"
    m = H2.match(line)
    if m:
        return f"{m.group(1)}{BOLD}{MAGENTA}## {m.group(2)}{RESET}\n"
    m = H1.match(line)
    if m:
        return f"{m.group(1)}{BOLD}{CYAN}# {m.group(2)}{RESET}\n"
    m = BULLET.match(line)
    if m:
        rest = m.group(2)
        # Apply inline transforms to the bullet content
        rest = BOLD_RE.sub(rf"{BOLD}\1{RESET}", rest)
        rest = INLINE_CODE.sub(rf"{DIM}\1{RESET}", rest)
        return f"{m.group(1)}{CYAN}•{RESET} {rest}\n"
    m = ORDERED.match(line)
    if m:
        rest = m.group(3)
        rest = BOLD_RE.sub(rf"{BOLD}\1{RESET}", rest)
        rest = INLINE_CODE.sub(rf"{DIM}\1{RESET}", rest)
        return f"{m.group(1)}{CYAN}{m.group(2)}.{RESET} {rest}\n"
    # Plain line — only apply inline substitutions
    out = line
    out = BOLD_RE.sub(rf"{BOLD}\1{RESET}", out)
    out = INLINE_CODE.sub(rf"{DIM}\1{RESET}", out)
    return out


def main() -> int:
    try:
        for line in sys.stdin:
            sys.stdout.write(transform(line))
            sys.stdout.flush()
    except (KeyboardInterrupt, BrokenPipeError):
        return 130
    return 0


if __name__ == "__main__":
    sys.exit(main())
