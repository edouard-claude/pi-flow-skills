// flow-auto.ts — orchestrates /flow-story → /flow-dev → /flow-review → /flow-commit
// over every ready-for-dev story in the sprint, restarting Pi with --no-session
// between each call (equivalent to /clear).

import { existsSync, readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { runPiPhase, piPreflight } from './lib/pi-runner.js';
import {
  load as loadSprint,
  storyStatus,
  forceStatus,
  nextStory,
  countByStatus,
  currentEpic,
  type SprintStatus,
} from './lib/sprint-status.js';
import {
  colors,
  termSize,
  CLEAR_SCREEN_HOME,
  CLEAR_LINE,
  SAVE_CURSOR,
  RESTORE_CURSOR,
  SHOW_CURSOR,
  cursorAt,
  setScrollingRegion,
  RESET_SCROLLING_REGION,
  writeErr,
} from './lib/ansi.js';

const HEADER_LINES = 12;

// ── env-derived configuration ─────────────────────────────────────────────────
const STATUS_PATH = process.argv[2] ?? '.agents/implementation/sprint-status.yaml';
const PI_BIN = process.env['PI_BIN'] ?? 'pi';
const PI_MODE: 'json' | 'text' =
  process.env['PI_MODE'] === 'text' ? 'text' : 'json';
const PI_RAW = process.env['PI_RAW'] === '1';
const NO_STICKY = process.env['NO_STICKY_HEADER'] !== undefined;

// Propagate batch + parallel flags to every spawned pi child.
process.env['FLOW_AUTO'] = '1';
if (process.env['FLOW_PARALLEL'] === undefined) {
  process.env['FLOW_PARALLEL'] = '1';
}
const FLOW_PARALLEL = process.env['FLOW_PARALLEL'];

// ── BATCH_PROMPT — injected as --append-system-prompt to every phase ──────────
const BATCH_PROMPT = `BATCH MODE ACTIVE. You have NO interactive stdin.

Rules:
1. Never ask the user for confirmation, validation, or a choice. No menus.
2. If a skill says "wait for GO", "present menu", "Continue/Revise/Pause",
   "(a) Apply / (b) Edit / (c) Cancel" — SKIP that gate, apply the default action,
   continue silently.
3. Use your best judgment. Do not seek clarification.
4. Auto-approve all internal tool calls (read, bash, edit, write).
5. If you genuinely lack the info to proceed (architecture ambiguity, missing
   dependency, test impossible to write), write the blocker into the relevant
   story file's Dev Notes section and exit with a clear error message.
6. The $FLOW_AUTO=1 env var means: this is gospel, not optional.
7. CRITICAL — sprint-status.yaml update. The file has TWO blocks:
     development_status: { <id>: <status>, ... }   <- EDIT ONLY THIS LINE
     dependencies:       { ... }                   <- NEVER touch (auto-managed)
   You MUST edit ONE line: \`development_status[<story-id>]: <new-status>\`.
   Nothing else. No new keys, no comments, no free text.
   State machine (5 states): backlog -> ready-for-dev -> in-progress -> review -> done.
   Transitions per skill:
     - flow-story   -> set status to: ready-for-dev
     - flow-dev     -> set status to: review (or leave in-progress on halt)
     - flow-review  -> APPROVED: do NOT change status (keep review), append a
                                 "## Senior Review" section to the story file.
                       REWORK:   set status to: in-progress, add [AI-Review]
                                 items at the bottom of the story file.
     - flow-commit  -> set status to: done. If all stories of the epic are
                       done, also flip development_status[epic-NNN]: done.
   All free-form text (decisions, dev notes, review findings, file lists)
   belongs in the markdown story file, NEVER in sprint-status.yaml.
   If you can't determine the right transition, write a note in the story
   file's Dev Notes and exit non-zero — do not leave the YAML inconsistent.

You are inside a bash loop that pipelines flow-story → flow-dev → flow-review →
flow-commit per story across the whole sprint. Each invocation must terminate
on its own (no infinite wait).`;

// ── Sticky header decision ────────────────────────────────────────────────────
const isSticky = ((): boolean => {
  if (NO_STICKY) return false;
  if (!process.stderr.isTTY) return false;
  const { rows } = termSize();
  return rows >= 24;
})();

// ── Preflight ─────────────────────────────────────────────────────────────────
const fail = (msg: string): never => {
  process.stderr.write(msg + '\n');
  process.exit(1);
};

const preflight = async (): Promise<void> => {
  if (!existsSync(STATUS_PATH)) {
    fail(`ERROR: sprint-status not found: ${STATUS_PATH}\nRun /flow-sprint first.`);
  }
  process.stderr.write('>>> pre-flight: validating pi extensions...\n');
  const piErr = await piPreflight(PI_BIN);
  if (piErr !== null) {
    process.stderr.write(`ERROR: ${piErr}\n\n`);
    process.stderr.write(
      `Fix options:\n` +
      `  - Edit the broken file in ~/.pi/agent/extensions/\n` +
      `  - Or disable it temporarily: mv <path>.ts <path>.ts.disabled\n` +
      `  - Then re-run this script.\n`,
    );
    process.exit(1);
  }
  process.stderr.write('>>> pre-flight OK.\n');
};

// ── Rendering ─────────────────────────────────────────────────────────────────

const progressBar = (done: number, total: number, width = 40): string => {
  const { GREEN, GRAY, RESET } = colors;
  const filled = total > 0 ? Math.floor((done * width) / total) : 0;
  return GREEN + '█'.repeat(filled) + GRAY + '░'.repeat(width - filled) + RESET;
};

const formatHeaderLines = (s: SprintStatus): string[] => {
  const { RESET, BOLD, DIM, GREEN, YELLOW, BLUE, GRAY, CYAN } = colors;
  const counts = countByStatus(s);
  const pct = counts.total > 0
    ? Math.floor((counts.done * 100) / counts.total)
    : 0;
  const bar = progressBar(counts.done, counts.total);
  const epic = currentEpic(s);
  const epicLine = epic !== null
    ? `${BOLD}Current epic${RESET}  ${CYAN}${epic.id}${RESET}  ${DIM}(${epic.status} — ${epic.done}/${epic.total})${RESET}`
    : '';
  const lines = [
    `${BOLD}${CYAN}╭──────────────────────────────────────────────────────────╮${RESET}`,
    `${BOLD}${CYAN}│              flow-auto — sprint orchestrator             │${RESET}`,
    `${BOLD}${CYAN}╰──────────────────────────────────────────────────────────╯${RESET}`,
    `${DIM}  status: ${STATUS_PATH}${RESET}`,
    `${DIM}  pi: ${PI_BIN}  |  mode: ${PI_MODE}  |  FLOW_AUTO=1  |  FLOW_PARALLEL=${FLOW_PARALLEL}${RESET}`,
    '',
    `${BOLD}Progress${RESET} ${bar} ${BOLD}${pct}%${RESET} ${DIM}(${counts.done}/${counts.total})${RESET}`,
    `  ${GREEN}● done ${counts.done}${RESET}  ${YELLOW}● in-flight ${counts.inFlight}${RESET}  ${BLUE}● ready ${counts.ready}${RESET}  ${GRAY}● backlog ${counts.backlog}${RESET}`,
    '',
    epicLine,
  ];
  while (lines.length < HEADER_LINES) lines.push('');
  return lines.slice(0, HEADER_LINES);
};

const renderHeaderAbsolute = (s: SprintStatus): void => {
  const lines = formatHeaderLines(s);
  let out = '';
  for (let i = 0; i < lines.length; i++) {
    out += cursorAt(i + 1, 1) + CLEAR_LINE + (lines[i] ?? '');
  }
  writeErr(out);
};

const printBanner = (): void => {
  const { RESET, BOLD, DIM, CYAN } = colors;
  writeErr(
    `${BOLD}${CYAN}╭──────────────────────────────────────────────────────────╮${RESET}\n` +
    `${BOLD}${CYAN}│              flow-auto — sprint orchestrator             │${RESET}\n` +
    `${BOLD}${CYAN}╰──────────────────────────────────────────────────────────╯${RESET}\n` +
    `${DIM}  status: ${STATUS_PATH}${RESET}\n` +
    `${DIM}  pi: ${PI_BIN}  |  mode: ${PI_MODE}  |  FLOW_AUTO=1  |  FLOW_PARALLEL=${FLOW_PARALLEL}${RESET}\n`,
  );
};

const printDashboard = (s: SprintStatus): void => {
  const { RESET, BOLD, DIM, GREEN, YELLOW, BLUE, GRAY, CYAN } = colors;
  const counts = countByStatus(s);
  const pct = counts.total > 0
    ? Math.floor((counts.done * 100) / counts.total)
    : 0;
  const bar = progressBar(counts.done, counts.total);
  writeErr(
    `${BOLD}Progress${RESET}  ${bar}  ${BOLD}${pct}%${RESET}  ${DIM}(${counts.done}/${counts.total} stories)${RESET}\n` +
    `  ${GREEN}● done ${counts.done}${RESET}  ${YELLOW}● in-flight ${counts.inFlight}${RESET}  ${BLUE}● ready ${counts.ready}${RESET}  ${GRAY}● backlog ${counts.backlog}${RESET}\n\n`,
  );

  const epic = currentEpic(s);
  if (epic !== null) {
    writeErr(
      `${BOLD}Current epic${RESET}  ${CYAN}${epic.id}${RESET}  ${DIM}(${epic.status} — ${epic.done}/${epic.total} stories)${RESET}\n`,
    );
  }

  const doneIds = new Set(
    Object.entries(s.development_status)
      .filter(([sid, st]) => /^story-\d+-\d+$/.test(sid) && st === 'done')
      .map(([sid]) => sid),
  );
  const STORY_RE = /^story-\d+-\d+$/;
  const isActionable = (sid: string, st: string): boolean => {
    if (st === 'in-progress' || st === 'review' || st === 'ready-for-dev') return true;
    if (st === 'backlog') {
      const deps = s.dependencies[sid] ?? [];
      return deps.every((d) => doneIds.has(d));
    }
    return false;
  };
  const actionable = Object.entries(s.development_status)
    .filter(([sid, st]) => STORY_RE.test(sid) && isActionable(sid, st))
    .slice(0, 5);
  if (actionable.length > 0) {
    writeErr(`${DIM}Next actionable:${RESET}\n`);
    const sym: Record<string, [string, string]> = {
      'done':          [GREEN, '✓'],
      'in-progress':   [YELLOW, '▶'],
      'review':        [YELLOW, '▶'],
      'ready-for-dev': [BLUE, '◆'],
      'backlog':       [GRAY, '○'],
    };
    for (const [sid, st] of actionable) {
      const [col, s2] = sym[st] ?? [GRAY, '?'];
      writeErr(`  ${col}${s2}${RESET}  ${sid}  ${DIM}${st}${RESET}\n`);
    }
  }
  writeErr('\n');
};

const stickySetup = (): void => {
  if (!isSticky) return;
  writeErr(CLEAR_SCREEN_HOME);
};

const stickyLockBelowHeader = (): void => {
  if (!isSticky) return;
  const { rows } = termSize();
  writeErr(setScrollingRegion(HEADER_LINES + 1, rows));
  writeErr(cursorAt(HEADER_LINES + 1, 1));
};

const stickyReset = (): void => {
  if (!isSticky) return;
  writeErr(RESET_SCROLLING_REGION + SHOW_CURSOR);
};

const refreshHeader = (s: SprintStatus): void => {
  if (!isSticky) {
    printBanner();
    return;
  }
  writeErr(SAVE_CURSOR + RESET_SCROLLING_REGION);
  renderHeaderAbsolute(s);
  const { rows } = termSize();
  writeErr(setScrollingRegion(HEADER_LINES + 1, rows));
  writeErr(RESTORE_CURSOR);
};

// ── Run a single phase via pi sub-process ─────────────────────────────────────
const runPhase = async (phase: string, story: string): Promise<void> => {
  const { RESET, BOLD, DIM, BLUE } = colors;
  writeErr(
    `${BLUE}▶ phase:${RESET} ${BOLD}${phase}${RESET}  ${DIM}story: ${story}  (ephemeral, mode: ${PI_MODE})${RESET}\n`,
  );
  const rc = await runPiPhase({
    binary: PI_BIN,
    phase,
    story,
    systemPrompt: BATCH_PROMPT,
    mode: PI_MODE,
    raw: PI_RAW,
  });
  if (rc !== 0) {
    process.stderr.write(`ERROR: /${phase} ${story} failed (code ${rc})\n`);
    throw new Error(`phase ${phase} failed`);
  }
};

const ensureStatusTransition = (sid: string, expected: string): void => {
  const s = loadSprint(STATUS_PATH);
  const current = storyStatus(s, sid);
  if (current === expected) return;
  if (current === 'missing') {
    process.stderr.write(
      `ABORT: story '${sid}' missing from development_status in ${STATUS_PATH} (broken YAML?)\n`,
    );
    process.exit(1);
  }
  process.stderr.write(
    `WARN: forcing status for ${sid} (${current} -> ${expected}, LLM didn't update)\n`,
  );
  const ok = forceStatus(STATUS_PATH, sid, expected);
  if (!ok) {
    process.stderr.write(`ERROR: regex did not match '${sid}:' in ${STATUS_PATH}\n`);
    process.exit(1);
  }
};

const hasSeniorReviewSection = (storyPath: string): boolean => {
  if (!existsSync(storyPath)) return false;
  const text = readFileSync(storyPath, 'utf8');
  return /^#{1,3}\s+Senior Review/m.test(text);
};

const printSummary = (storiesDone: number, elapsedSec: number): void => {
  const { RESET, BOLD, GREEN } = colors;
  const mins = Math.floor(elapsedSec / 60);
  const secs = elapsedSec % 60;
  writeErr('\n');
  writeErr(
    `${BOLD}${GREEN}╭──────────────────────────────────────────────────────────╮${RESET}\n`,
  );
  const msg = `Done — ${storiesDone} stories processed in ${mins}m${secs}s`;
  writeErr(
    `${BOLD}${GREEN}│  ✓  ${msg.padEnd(52)}│${RESET}\n`,
  );
  writeErr(
    `${BOLD}${GREEN}╰──────────────────────────────────────────────────────────╯${RESET}\n`,
  );
};

// ── Main loop ─────────────────────────────────────────────────────────────────

const main = async (): Promise<number> => {
  await preflight();

  process.on('SIGINT', () => { stickyReset(); process.exit(130); });
  process.on('SIGTERM', () => { stickyReset(); process.exit(143); });
  process.on('exit', () => { stickyReset(); });

  let sprint = loadSprint(STATUS_PATH);

  if (isSticky) {
    stickySetup();
    renderHeaderAbsolute(sprint);
    stickyLockBelowHeader();
    printDashboard(sprint);
  } else {
    printBanner();
    printDashboard(sprint);
  }

  const startTime = Date.now();
  let total = 0;

  for (;;) {
    sprint = loadSprint(STATUS_PATH);
    const sid = nextStory(sprint);
    if (sid === null) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      stickyReset();
      printSummary(total, elapsed);
      return 0;
    }

    total++;
    const initial = storyStatus(sprint, sid);
    const { RESET, BOLD, DIM, MAGENTA } = colors;
    writeErr(
      `\n${BOLD}${MAGENTA}━━━ STORY #${total} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n` +
      `${BOLD}  ${sid}${RESET}  ${DIM}(entering from: ${initial})${RESET}\n` +
      `${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`,
    );

    if (storyStatus(loadSprint(STATUS_PATH), sid) === 'backlog') {
      await runPhase('flow-story', sid);
      ensureStatusTransition(sid, 'ready-for-dev');
    }

    {
      const st = storyStatus(loadSprint(STATUS_PATH), sid);
      if (st === 'ready-for-dev' || st === 'in-progress') {
        await runPhase('flow-dev', sid);
        const stAfter = storyStatus(loadSprint(STATUS_PATH), sid);
        if (stAfter === 'ready-for-dev' || stAfter === 'backlog') {
          ensureStatusTransition(sid, 'review');
        }
      }
    }

    const storyFile = resolvePath('.agents/implementation/stories', `${sid}.md`);
    let needsReview = false;
    const phase3Status = storyStatus(loadSprint(STATUS_PATH), sid);
    if (phase3Status === 'review') {
      if (hasSeniorReviewSection(storyFile)) {
        writeErr(`skip flow-review: Senior Review already present in ${storyFile}\n`);
      } else {
        needsReview = true;
      }
    } else if (phase3Status === 'in-progress') {
      needsReview = true;
    }

    if (needsReview) {
      let attempts = 0;
      for (;;) {
        attempts++;
        if (attempts > 3) {
          process.stderr.write(
            `ABORT: too many dev/review cycles on ${sid} (${attempts} attempts)\n`,
          );
          return 1;
        }
        await runPhase('flow-review', sid);
        const st = storyStatus(loadSprint(STATUS_PATH), sid);
        if (st === 'review') break;
        if (st === 'in-progress') {
          await runPhase('flow-dev', sid);
          continue;
        }
        process.stderr.write(`ABORT: unexpected status after flow-review: '${st}'\n`);
        return 1;
      }
    }

    if (storyStatus(loadSprint(STATUS_PATH), sid) === 'review') {
      await runPhase('flow-commit', sid);
      ensureStatusTransition(sid, 'done');
    }

    const { GREEN, BOLD: B } = colors;
    writeErr(`${GREEN}${B}✓ ${sid}${colors.RESET}${colors.DIM} → done${colors.RESET}\n`);
    refreshHeader(loadSprint(STATUS_PATH));
  }
};

const code = await main().catch((e: unknown) => {
  stickyReset();
  const msg = e instanceof Error ? e.message : String(e);
  process.stderr.write(`flow-auto: ${msg}\n`);
  return 1;
});
process.exit(code);
