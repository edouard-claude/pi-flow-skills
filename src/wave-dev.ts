// wave-dev.ts — pre-dev parallel research wave.
//
// Spawns 3 ephemeral pi sub-agents in parallel (find-similar-impl,
// check-dependencies, enumerate-tests), then synthesizes their outputs.

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import {
  ensureDir,
  flowInternalDir,
  isParallelEnabled,
  piBinary,
  runInParallel,
  runSynthesizer,
  tidyErrFiles,
  writeFailureFallback,
  writeSkippedSynthesis,
  writeSynthesizerFallback,
} from './lib/wave.js';

const extractSection = (text: string, headerRe: RegExp): string[] => {
  const lines = text.split('\n');
  const out: string[] = [];
  let inSection = false;
  for (const line of lines) {
    if (headerRe.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && /^##\s/.test(line)) break;
    if (inSection) out.push(line);
  }
  return out;
};

const extractTouchedPaths = (storyText: string): string[] => {
  const block = extractSection(storyText, /^##\s+Files to touch/i);
  const re = /^\s*-\s+(CREATE|UPDATE|DELETE):\s*([^\s—-]+)/;
  const paths: string[] = [];
  for (const line of block) {
    const m = re.exec(line);
    if (m !== null && m[2] !== undefined) paths.push(m[2]);
  }
  return paths;
};

const extractImplPatterns = (storyText: string): string[] => {
  const block = extractSection(storyText, /^##\s+Implementation plan/i);
  const re = /^\s*\d+\.\s*(.+)$/;
  const patterns: string[] = [];
  for (const line of block) {
    const m = re.exec(line);
    if (m !== null && m[1] !== undefined) patterns.push(m[1].trim());
    if (patterns.length >= 10) break;
  }
  return patterns;
};

const main = async (): Promise<number> => {
  const storyId = process.argv[2];
  if (typeof storyId !== 'string' || storyId === '') {
    process.stderr.write('usage: wave-dev.mjs <story-id>\n');
    return 1;
  }

  const internalDir = flowInternalDir(import.meta.url);
  const storyPath = `.agents/implementation/stories/${storyId}.md`;
  const statusPath = '.agents/implementation/sprint-status.yaml';
  const outDir = `.agents/internal/${storyId}-dev`;

  await ensureDir(outDir);

  if (!isParallelEnabled()) {
    await writeSkippedSynthesis(
      `${outDir}/synthesis.md`,
      storyId,
      'Parent proceeds with red-green-refactor directly from the story file.',
    );
    process.stdout.write('wave-dev: skipped (FLOW_PARALLEL=0)\n');
    return 0;
  }

  if (!existsSync(storyPath)) {
    process.stderr.write(`ERROR: story file not found: ${storyPath}\n`);
    return 1;
  }

  const storyText = await readFile(storyPath, 'utf8');
  const touched = extractTouchedPaths(storyText);
  const impl = extractImplPatterns(storyText);
  const binary = piBinary();

  const simInput =
    `STORY_ID: ${storyId}\nSTORY_PATH: ${storyPath}\nIMPL_PATTERNS:\n` +
    impl.map((p) => `- ${p}`).join('\n') + '\n\n' +
    `Scan for prior art per your output schema.`;

  const depsInput =
    `STORY_ID: ${storyId}\nSTORY_PATH: ${storyPath}\n` +
    `STATUS_PATH: ${statusPath}\n` +
    `STORIES_DIR: .agents/implementation/stories/\n\n` +
    `Map coupling per your output schema.`;

  const testsInput =
    `STORY_ID: ${storyId}\nSTORY_PATH: ${storyPath}\nTOUCHED_PATHS:\n` +
    touched.join('\n') + '\n\n' +
    `Inventory tests per your output schema.`;

  process.stdout.write(
    'wave-dev: spawning similar-impl + dependencies + tests sub-agents in parallel...\n',
  );

  const results = await runInParallel(binary, outDir, [
    {
      name: 'similar-impl',
      templatePath: `${internalDir}/find-similar-impl.md`,
      taskInput: simInput,
    },
    {
      name: 'dependencies',
      templatePath: `${internalDir}/check-dependencies.md`,
      taskInput: depsInput,
    },
    {
      name: 'tests',
      templatePath: `${internalDir}/enumerate-tests.md`,
      taskInput: testsInput,
    },
  ]);

  for (const r of results) {
    if (r.rc !== 0) {
      process.stderr.write(
        `WARN: ${r.name} sub-agent failed (rc=${r.rc}). See ${r.errPath}\n`,
      );
      await writeFailureFallback(r.outputPath, r.name, storyId, r.rc);
    }
  }

  const synthInput =
    `WAVE_KIND: pre-dev-research\nSTORY_ID: ${storyId}\n\n` +
    `Read these three sub-agent reports and synthesize per your output schema.\n` +
    `Emphasis: surface concrete reuse opportunities and coupling risks the implementer\n` +
    `must acknowledge before the red-green-refactor loop.\n` +
    `- similar-impl: ${outDir}/similar-impl.md\n` +
    `- dependencies: ${outDir}/dependencies.md\n` +
    `- tests: ${outDir}/tests.md\n`;

  process.stdout.write('wave-dev: synthesizing...\n');

  const rc = await runSynthesizer({
    binary,
    templatePath: `${internalDir}/synthesize.md`,
    taskInput: synthInput,
    outputPath: `${outDir}/synthesis.md`,
    errPath: `${outDir}/synthesis.err`,
  });

  if (rc !== 0) {
    process.stderr.write(`WARN: synthesize sub-agent failed (rc=${rc}).\n`);
    await writeSynthesizerFallback(
      `${outDir}/synthesis.md`,
      storyId,
      [`${outDir}/similar-impl.md`, `${outDir}/dependencies.md`, `${outDir}/tests.md`],
    );
  }

  await tidyErrFiles(outDir);
  process.stdout.write(`wave-dev: done → ${outDir}/synthesis.md\n`);
  return 0;
};

const code = await main();
process.exit(code);
