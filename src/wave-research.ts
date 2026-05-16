// wave-research.ts — pre-story parallel research wave.
//
// Spawns 2 ephemeral pi sub-agents (research-corpus + research-conventions)
// in parallel, then runs synthesize over their outputs.

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
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

const main = async (): Promise<number> => {
  const storyId = process.argv[2];
  if (typeof storyId !== 'string' || storyId === '') {
    process.stderr.write('usage: wave-research.mjs <story-id>\n');
    return 1;
  }

  const internalDir = flowInternalDir(import.meta.url);
  const outDir = `.agents/internal/${storyId}`;
  const inputFile = `${outDir}/_input.md`;

  await ensureDir(outDir);

  if (!isParallelEnabled()) {
    await writeSkippedSynthesis(
      `${outDir}/synthesis.md`,
      storyId,
      'Parent should proceed with classic exhaustive context-gathering steps.',
    );
    process.stdout.write('wave-research: skipped (FLOW_PARALLEL=0)\n');
    return 0;
  }

  if (!existsSync(inputFile)) {
    process.stderr.write(
      `ERROR: ${inputFile} not found.\n` +
      `  The parent must write STORY_ID/TITLE/SUMMARY/EPIC_PATH/ARCH_PATH there first.\n`,
    );
    return 1;
  }

  const taskInput = await readFile(inputFile, 'utf8');
  const binary = piBinary();

  process.stdout.write(
    'wave-research: spawning corpus + conventions sub-agents in parallel...\n',
  );

  const results = await runInParallel(binary, outDir, [
    {
      name: 'corpus',
      templatePath: `${internalDir}/research-corpus.md`,
      taskInput,
    },
    {
      name: 'conventions',
      templatePath: `${internalDir}/research-conventions.md`,
      taskInput,
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
    `WAVE_KIND: pre-story-research\nSTORY_ID: ${storyId}\n\n` +
    `Read these two short reports and synthesize per your output schema:\n` +
    `- corpus_map: ${outDir}/corpus.md\n` +
    `- conventions_audit: ${outDir}/conventions.md\n`;

  process.stdout.write('wave-research: synthesizing...\n');

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
      [`${outDir}/corpus.md`, `${outDir}/conventions.md`],
    );
  }

  await tidyErrFiles(outDir);
  process.stdout.write(`wave-research: done → ${outDir}/synthesis.md\n`);

  // Touch writeFile reference so esbuild doesn't tree-shake the import
  // (no real call needed — the helpers in wave.ts use it).
  void writeFile;

  return 0;
};

const code = await main();
process.exit(code);
