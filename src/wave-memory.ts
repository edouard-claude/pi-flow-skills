// wave-memory.ts — long-term memory condensation at end of epic.
//
// Spawns memory-condenser over the closing epic, parses its sectioned output,
// and appends each section to the corresponding file under .agents/memory/.

import { existsSync, readdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import {
  ensureDir,
  flowInternalDir,
  isParallelEnabled,
  piBinary,
} from './lib/wave.js';
import { runPiSubAgent, cleanupEmptyErrFiles } from './lib/pi-runner.js';
import { parseSections } from './lib/markdown.js';

const today = (): string => new Date().toISOString().slice(0, 10);

const findEpicFile = (epicId: string): string | null => {
  const dir = '.agents/planning/epics';
  if (!existsSync(dir)) return null;
  const entries = readdirSync(dir);
  for (const name of entries) {
    if (name.startsWith(`${epicId}-`) && name.endsWith('.md')) {
      return `${dir}/${name}`;
    }
    if (name === `${epicId}.md`) return `${dir}/${name}`;
  }
  return null;
};

const ensureFile = async (path: string, header: string): Promise<void> => {
  if (!existsSync(path)) await writeFile(path, `# ${header}\n\n`);
};

const appendBlock = async (
  path: string,
  header: string,
  body: string,
  epicId: string,
  date: string,
  attribution: string,
): Promise<void> => {
  await ensureFile(path, header);
  const current = await readFile(path, 'utf8');
  const block = `\n## ${date} — ${epicId} (${attribution})\n\n${body}\n`;
  await writeFile(path, current + block);
};

const appendDecisions = async (
  path: string,
  body: string,
): Promise<void> => {
  await ensureFile(path, 'Decisions (ADR-style)');
  const current = await readFile(path, 'utf8');
  const existing = new Set<string>();
  const titleRe = /^###\s+\S+\s+—\s+(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = titleRe.exec(current)) !== null) {
    existing.add((m[1] ?? '').trim().toLowerCase());
  }
  const entries = body.split(/(?=^###\s)/m).map((s) => s.trim()).filter(Boolean);
  const kept: string[] = [];
  const oneTitleRe = /^###\s+\S+\s+—\s+(.+)$/m;
  for (const entry of entries) {
    const t = oneTitleRe.exec(entry);
    if (t !== null && existing.has((t[1] ?? '').trim().toLowerCase())) continue;
    kept.push(entry);
  }
  if (kept.length > 0) {
    await writeFile(path, current + '\n' + kept.join('\n\n') + '\n');
  }
};

const appendLessons = async (
  path: string,
  body: string,
  epicId: string,
  date: string,
): Promise<void> => {
  await ensureFile(path, 'Lessons');
  const current = await readFile(path, 'utf8');
  const existing = new Set<string>();
  const re = /^-\s+\*\*(.+?)\*\*/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(current)) !== null) {
    existing.add((m[1] ?? '').trim().toLowerCase());
  }
  const oneRe = /^-\s+\*\*(.+?)\*\*/;
  const fresh: string[] = [];
  for (const line of body.split('\n')) {
    const t = oneRe.exec(line.trim());
    if (t !== null && existing.has((t[1] ?? '').trim().toLowerCase())) continue;
    fresh.push(line);
  }
  const joined = fresh.join('\n').trim();
  if (joined.length > 0) {
    await writeFile(path, current + `\n## ${date} — ${epicId}\n\n${joined}\n`);
  }
};

const appendGlossary = async (path: string, body: string): Promise<void> => {
  await ensureFile(path, 'Glossary');
  const current = await readFile(path, 'utf8');
  const existing = new Set<string>();
  const re = /^-\s+\*\*(.+?)\*\*/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(current)) !== null) {
    existing.add((m[1] ?? '').trim().toLowerCase());
  }
  const oneRe = /^-\s+\*\*(.+?)\*\*/;
  const fresh: string[] = [];
  for (const line of body.split('\n')) {
    const t = oneRe.exec(line.trim());
    if (t === null) continue;
    if (existing.has((t[1] ?? '').trim().toLowerCase())) continue;
    fresh.push(line);
  }
  if (fresh.length > 0) {
    await writeFile(path, current + '\n' + fresh.join('\n') + '\n');
  }
};

const replaceOverview = async (
  path: string,
  body: string,
  epicId: string,
  date: string,
): Promise<void> => {
  await ensureFile(path, 'Overview');
  const current = await readFile(path, 'utf8');
  // Archive any existing "État actuel — <date> (post-<id>)" header.
  const archived = current.replace(
    /^##\s+État actuel\s+—\s+(\S+)\s+\(post-\S+\)\s*$/gm,
    (_m, d: string) => `## État au ${d}`,
  );
  const block = `\n## État actuel — ${date} (post-${epicId})\n\n${body}\n`;
  await writeFile(path, archived + block);
};

const main = async (): Promise<number> => {
  const epicId = process.argv[2];
  const retroPath = process.argv[3];
  if (typeof epicId !== 'string' || epicId === '' ||
      typeof retroPath !== 'string' || retroPath === '') {
    process.stderr.write('usage: wave-memory.mjs <epic-id> <retro-path>\n');
    return 1;
  }

  if (!isParallelEnabled()) {
    process.stdout.write('wave-memory: skipped (FLOW_PARALLEL=0)\n');
    return 0;
  }

  if (!existsSync(retroPath)) {
    process.stderr.write(`ERROR: retro file not found: ${retroPath}\n`);
    return 1;
  }

  const internalDir = flowInternalDir(import.meta.url);
  const memoryDir = '.agents/memory';
  const workDir = `.agents/internal/${epicId}-memory`;

  const epicFile = findEpicFile(epicId);
  if (epicFile === null) {
    process.stderr.write(
      `ERROR: cannot find epic file for ${epicId} under .agents/planning/epics/\n`,
    );
    return 1;
  }

  await ensureDir(memoryDir);
  await ensureDir(workDir);

  const date = today();
  const epicNum = epicId.replace(/^epic-/, '');
  const condenserTemplate = `${internalDir}/memory-condenser.md`;
  if (!existsSync(condenserTemplate)) {
    process.stderr.write(`ERROR: missing ${condenserTemplate}\n`);
    return 1;
  }
  const prompt = await readFile(condenserTemplate, 'utf8');

  const taskInput = [
    `EPIC_ID: ${epicId}`,
    `EPIC_PATH: ${epicFile}`,
    `STORIES_DIR: .agents/implementation/stories/`,
    `STORIES_GLOB: story-${epicNum}-*.md`,
    `RETRO_PATH: ${retroPath}`,
    `MEMORY_DIR: ${memoryDir}`,
    `PRD_PATH: .agents/planning/prd.md`,
    `ARCH_PATH: .agents/planning/architecture.md`,
    `TODAY: ${date}`,
    ``,
    `Condense per your output schema. The wave script parses on '## SECTION: <name>' markers.`,
  ].join('\n');

  process.stdout.write(`wave-memory: condensing ${epicId}...\n`);

  const outFile = `${workDir}/condensation.md`;
  const errFile = `${workDir}/condensation.err`;
  const rc = await runPiSubAgent({
    binary: piBinary(),
    systemPrompt: prompt,
    taskInput,
    outputFile: outFile,
    errFile,
  });

  if (rc !== 0) {
    process.stderr.write(
      `WARN: memory-condenser failed (rc=${rc}). See ${errFile}\n` +
      `wave-memory: aborted, memory unchanged.\n`,
    );
    return 0;
  }

  const condensation = await readFile(outFile, 'utf8');
  const sections = parseSections(condensation);
  const changed: string[] = [];

  const overview = sections.get('overview');
  if (overview !== undefined && overview.toLowerCase() !== 'no change') {
    await replaceOverview(`${memoryDir}/overview.md`, overview, epicId, date);
    changed.push('overview.md');
  }
  const decisions = sections.get('decisions');
  if (decisions !== undefined && decisions.toLowerCase() !== 'no change') {
    await appendDecisions(`${memoryDir}/decisions.md`, decisions);
    changed.push('decisions.md');
  }
  const lessons = sections.get('lessons');
  if (lessons !== undefined && lessons.toLowerCase() !== 'no change') {
    await appendLessons(`${memoryDir}/lessons.md`, lessons, epicId, date);
    changed.push('lessons.md');
  }
  const glossary = sections.get('glossary');
  if (glossary !== undefined && glossary.toLowerCase() !== 'no change') {
    await appendGlossary(`${memoryDir}/glossary.md`, glossary);
    changed.push('glossary.md');
  }
  const journal = sections.get('journal');
  if (journal !== undefined && journal.toLowerCase() !== 'no change') {
    await appendBlock(
      `${memoryDir}/journal.md`,
      'Journal',
      journal,
      epicId,
      date,
      'closeout',
    );
    changed.push('journal.md');
  }

  process.stdout.write(
    `wave-memory: updated ${changed.length} file(s): ${changed.length > 0 ? changed.join(', ') : '(none)'}\n`,
  );
  await cleanupEmptyErrFiles(workDir);
  process.stdout.write(`wave-memory: done → ${memoryDir}/\n`);
  return 0;
};

const code = await main();
process.exit(code);
