// wave-review.ts — adversarial review wave.
//
// Spawns 3 ephemeral pi reviewers in parallel (blind, edge-cases, acceptance),
// then synthesizes their outputs.

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
import { gitChangedPaths } from './lib/git.js';

const extractFileList = (storyText: string): string[] => {
  const lines = storyText.split('\n');
  const out: string[] = [];
  let inSection = false;
  for (const line of lines) {
    if (/^##\s+File\s*[Ll]ist/.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && /^##\s/.test(line)) break;
    if (!inSection) continue;
    const m = /^\s*-\s+(CREATE|UPDATE|DELETE):\s*([^\s—-]+)/.exec(line);
    if (m !== null && m[2] !== undefined) out.push(m[2]);
  }
  return out;
};

const main = async (): Promise<number> => {
  const storyId = process.argv[2];
  if (typeof storyId !== 'string' || storyId === '') {
    process.stderr.write('usage: wave-review.mjs <story-id>\n');
    return 1;
  }

  const internalDir = flowInternalDir(import.meta.url);
  const storyPath = `.agents/implementation/stories/${storyId}.md`;
  const outDir = `.agents/internal/${storyId}-review`;

  await ensureDir(outDir);

  if (!isParallelEnabled()) {
    await writeSkippedSynthesis(
      `${outDir}/synthesis.md`,
      storyId,
      'Parent should perform the three review angles inline as in v0.3.',
    );
    process.stdout.write('wave-review: skipped (FLOW_PARALLEL=0)\n');
    return 0;
  }

  if (!existsSync(storyPath)) {
    process.stderr.write(`ERROR: story file not found: ${storyPath}\n`);
    return 1;
  }

  const storyText = await readFile(storyPath, 'utf8');
  let diffPaths = extractFileList(storyText);
  if (diffPaths.length === 0) diffPaths = gitChangedPaths();

  const diffBlock = diffPaths.join('\n');
  const binary = piBinary();

  const blindInput =
    `STORY_ID: ${storyId}\nDIFF_PATHS:\n${diffBlock}\n\n` +
    `Run git diff against these paths and review per your output schema.`;

  const sharedInput =
    `STORY_ID: ${storyId}\nSTORY_PATH: ${storyPath}\nDIFF_PATHS:\n${diffBlock}\n\n` +
    `Read the story file and the diff, then review per your output schema.`;

  process.stdout.write(
    'wave-review: spawning blind + edge-cases + acceptance reviewers in parallel...\n',
  );

  const results = await runInParallel(binary, outDir, [
    {
      name: 'blind',
      templatePath: `${internalDir}/review-blind.md`,
      taskInput: blindInput,
    },
    {
      name: 'edge-cases',
      templatePath: `${internalDir}/review-edge-cases.md`,
      taskInput: sharedInput,
    },
    {
      name: 'acceptance',
      templatePath: `${internalDir}/review-acceptance.md`,
      taskInput: sharedInput,
    },
  ]);

  for (const r of results) {
    if (r.rc !== 0) {
      process.stderr.write(
        `WARN: ${r.name} reviewer failed (rc=${r.rc}). See ${r.errPath}\n`,
      );
      await writeFailureFallback(r.outputPath, r.name, storyId, r.rc);
    }
  }

  const synthInput =
    `WAVE_KIND: parallel-review\nSTORY_ID: ${storyId}\n\n` +
    `Read these three reviewer outputs and synthesize per your output schema.\n` +
    `Pay special attention to severity escalation: if any reviewer flagged a blocker,\n` +
    `the synthesis must surface it under Contradictions (if disputed) or directly in\n` +
    `the TL;DR / Files-to-touch list.\n` +
    `- blind: ${outDir}/blind.md\n` +
    `- edge-cases: ${outDir}/edge-cases.md\n` +
    `- acceptance: ${outDir}/acceptance.md\n`;

  process.stdout.write('wave-review: synthesizing...\n');

  const rc = await runSynthesizer({
    binary,
    templatePath: `${internalDir}/synthesize.md`,
    taskInput: synthInput,
    outputPath: `${outDir}/synthesis.md`,
    errPath: `${outDir}/synthesis.err`,
  });

  if (rc !== 0) {
    process.stderr.write(`WARN: review synthesizer failed (rc=${rc}).\n`);
    await writeSynthesizerFallback(
      `${outDir}/synthesis.md`,
      storyId,
      [`${outDir}/blind.md`, `${outDir}/edge-cases.md`, `${outDir}/acceptance.md`],
    );
  }

  await tidyErrFiles(outDir);
  process.stdout.write(`wave-review: done → ${outDir}/synthesis.md\n`);
  return 0;
};

const code = await main();
process.exit(code);
