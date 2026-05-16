// Helpers shared by every wave-*.ts: parallel sub-agent spawn,
// failure fallbacks, synthesizer invocation, working dir setup.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPiSubAgent, cleanupEmptyErrFiles } from './pi-runner.js';

export interface SubAgentSpec {
  name: string;        // short identifier, used to derive output path
  templatePath: string; // absolute path to the prompt template (.md)
  taskInput: string;    // user-task body passed as the pi arg
}

export interface SubAgentResult {
  name: string;
  rc: number;
  outputPath: string;
  errPath: string;
}

// Resolves the flow-internal directory relative to the wave script's own location.
// The wave script is at skills/flow/<parent>/wave-*.mjs and templates live at
// skills/flow/flow-internal/<name>.md.
export const flowInternalDir = (importMetaUrl: string): string => {
  const here = dirname(fileURLToPath(importMetaUrl));
  return resolve(here, '..', 'flow-internal');
};

export const ensureDir = async (path: string): Promise<void> => {
  await mkdir(path, { recursive: true });
};

export const readTemplate = async (path: string): Promise<string> => {
  if (!existsSync(path)) {
    throw new Error(`sub-agent template missing: ${path}`);
  }
  return readFile(path, 'utf8');
};

export const runInParallel = async (
  binary: string,
  outDir: string,
  agents: SubAgentSpec[],
): Promise<SubAgentResult[]> => {
  const promises = agents.map(async (a): Promise<SubAgentResult> => {
    const prompt = await readTemplate(a.templatePath);
    const outputPath = `${outDir}/${a.name}.md`;
    const errPath = `${outDir}/${a.name}.err`;
    const rc = await runPiSubAgent({
      binary,
      systemPrompt: prompt,
      taskInput: a.taskInput,
      outputFile: outputPath,
      errFile: errPath,
    });
    return { name: a.name, rc, outputPath, errPath };
  });
  return Promise.all(promises);
};

// Writes a fallback markdown body for a sub-agent that failed,
// so downstream consumers (parent skill, synthesizer) see a readable file
// rather than empty output.
export const writeFailureFallback = async (
  outputPath: string,
  agentName: string,
  storyOrEpic: string,
  rc: number,
): Promise<void> => {
  const body = `# ${agentName} — ${storyOrEpic} (failed)\n\n` +
    `Sub-agent exited rc=${rc}. Parent should proceed without this report.\n`;
  await writeFile(outputPath, body);
};

export const writeSkippedSynthesis = async (
  outputPath: string,
  storyOrEpic: string,
  reason: string,
): Promise<void> => {
  const body = `# Wave synthesis — ${storyOrEpic} (skipped)\n\n` +
    `\`FLOW_PARALLEL=0\` — wave bypassed. ${reason}\n`;
  await writeFile(outputPath, body);
};

export const runSynthesizer = async (opts: {
  binary: string;
  templatePath: string;
  taskInput: string;
  outputPath: string;
  errPath: string;
}): Promise<number> => {
  const prompt = await readTemplate(opts.templatePath);
  return runPiSubAgent({
    binary: opts.binary,
    systemPrompt: prompt,
    taskInput: opts.taskInput,
    outputFile: opts.outputPath,
    errFile: opts.errPath,
  });
};

export const writeSynthesizerFallback = async (
  outputPath: string,
  storyOrEpic: string,
  rawPaths: string[],
): Promise<void> => {
  const body = `# Wave synthesis — ${storyOrEpic} (synthesizer failed)\n\n` +
    `Synthesizer sub-agent failed. Raw outputs:\n` +
    rawPaths.map((p) => `- ${p}`).join('\n') + '\n\n' +
    `Parent should read them directly.\n`;
  await writeFile(outputPath, body);
};

export const tidyErrFiles = (dir: string): Promise<void> =>
  cleanupEmptyErrFiles(dir);

// Convenience: pi binary lookup honouring PI_BIN override.
export const piBinary = (): string => process.env['PI_BIN'] ?? 'pi';

// Honour FLOW_PARALLEL=0 fallback uniformly.
export const isParallelEnabled = (): boolean =>
  process.env['FLOW_PARALLEL'] !== '0';
