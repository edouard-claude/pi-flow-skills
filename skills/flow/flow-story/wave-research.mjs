#!/usr/bin/env node

// src/wave-research.ts
import { existsSync as existsSync2 } from "node:fs";
import { readFile as readFile2, writeFile as writeFile2 } from "node:fs/promises";

// src/lib/wave.ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// src/lib/pi-runner.ts
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";

// src/lib/ansi.ts
var isTTY = () => process.stderr.isTTY === true && !process.env["NO_COLOR"];
var ON = {
  RESET: "\x1B[0m",
  BOLD: "\x1B[1m",
  DIM: "\x1B[2m",
  RED: "\x1B[31m",
  GREEN: "\x1B[32m",
  YELLOW: "\x1B[33m",
  BLUE: "\x1B[34m",
  MAGENTA: "\x1B[35m",
  CYAN: "\x1B[36m",
  GRAY: "\x1B[90m"
};
var OFF = {
  RESET: "",
  BOLD: "",
  DIM: "",
  RED: "",
  GREEN: "",
  YELLOW: "",
  BLUE: "",
  MAGENTA: "",
  CYAN: "",
  GRAY: ""
};
var colors = isTTY() ? ON : OFF;

// src/lib/pi-runner.ts
var runPiSubAgent = async (opts) => {
  const out = createWriteStream(opts.outputFile);
  const err = createWriteStream(opts.errFile);
  return new Promise((resolve2) => {
    const child = spawn(opts.binary, [
      "--print",
      "--no-session",
      "--append-system-prompt",
      opts.systemPrompt,
      opts.taskInput
    ], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env
    });
    child.stdout.pipe(out);
    child.stderr.pipe(err);
    child.on("close", (code2) => {
      out.end();
      err.end();
      resolve2(code2 ?? 1);
    });
  });
};
var cleanupEmptyErrFiles = async (dir) => {
  const { readdir, stat, unlink } = await import("node:fs/promises");
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (!name.endsWith(".err")) continue;
    const full = `${dir}/${name}`;
    try {
      const s = await stat(full);
      if (s.size === 0) await unlink(full);
    } catch {
    }
  }
};

// src/lib/wave.ts
var flowInternalDir = (importMetaUrl) => {
  const here = dirname(fileURLToPath(importMetaUrl));
  return resolve(here, "..", "flow-internal");
};
var ensureDir = async (path) => {
  await mkdir(path, { recursive: true });
};
var readTemplate = async (path) => {
  if (!existsSync(path)) {
    throw new Error(`sub-agent template missing: ${path}`);
  }
  return readFile(path, "utf8");
};
var runInParallel = async (binary, outDir, agents) => {
  const promises = agents.map(async (a) => {
    const prompt = await readTemplate(a.templatePath);
    const outputPath = `${outDir}/${a.name}.md`;
    const errPath = `${outDir}/${a.name}.err`;
    const rc = await runPiSubAgent({
      binary,
      systemPrompt: prompt,
      taskInput: a.taskInput,
      outputFile: outputPath,
      errFile: errPath
    });
    return { name: a.name, rc, outputPath, errPath };
  });
  return Promise.all(promises);
};
var writeFailureFallback = async (outputPath, agentName, storyOrEpic, rc) => {
  const body = `# ${agentName} \u2014 ${storyOrEpic} (failed)

Sub-agent exited rc=${rc}. Parent should proceed without this report.
`;
  await writeFile(outputPath, body);
};
var writeSkippedSynthesis = async (outputPath, storyOrEpic, reason) => {
  const body = `# Wave synthesis \u2014 ${storyOrEpic} (skipped)

\`FLOW_PARALLEL=0\` \u2014 wave bypassed. ${reason}
`;
  await writeFile(outputPath, body);
};
var runSynthesizer = async (opts) => {
  const prompt = await readTemplate(opts.templatePath);
  return runPiSubAgent({
    binary: opts.binary,
    systemPrompt: prompt,
    taskInput: opts.taskInput,
    outputFile: opts.outputPath,
    errFile: opts.errPath
  });
};
var writeSynthesizerFallback = async (outputPath, storyOrEpic, rawPaths) => {
  const body = `# Wave synthesis \u2014 ${storyOrEpic} (synthesizer failed)

Synthesizer sub-agent failed. Raw outputs:
` + rawPaths.map((p) => `- ${p}`).join("\n") + `

Parent should read them directly.
`;
  await writeFile(outputPath, body);
};
var tidyErrFiles = (dir) => cleanupEmptyErrFiles(dir);
var piBinary = () => process.env["PI_BIN"] ?? "pi";
var isParallelEnabled = () => process.env["FLOW_PARALLEL"] !== "0";

// src/wave-research.ts
var main = async () => {
  const storyId = process.argv[2];
  if (typeof storyId !== "string" || storyId === "") {
    process.stderr.write("usage: wave-research.mjs <story-id>\n");
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
      "Parent should proceed with classic exhaustive context-gathering steps."
    );
    process.stdout.write("wave-research: skipped (FLOW_PARALLEL=0)\n");
    return 0;
  }
  if (!existsSync2(inputFile)) {
    process.stderr.write(
      `ERROR: ${inputFile} not found.
  The parent must write STORY_ID/TITLE/SUMMARY/EPIC_PATH/ARCH_PATH there first.
`
    );
    return 1;
  }
  const taskInput = await readFile2(inputFile, "utf8");
  const binary = piBinary();
  process.stdout.write(
    "wave-research: spawning corpus + conventions sub-agents in parallel...\n"
  );
  const results = await runInParallel(binary, outDir, [
    {
      name: "corpus",
      templatePath: `${internalDir}/research-corpus.md`,
      taskInput
    },
    {
      name: "conventions",
      templatePath: `${internalDir}/research-conventions.md`,
      taskInput
    }
  ]);
  for (const r of results) {
    if (r.rc !== 0) {
      process.stderr.write(
        `WARN: ${r.name} sub-agent failed (rc=${r.rc}). See ${r.errPath}
`
      );
      await writeFailureFallback(r.outputPath, r.name, storyId, r.rc);
    }
  }
  const synthInput = `WAVE_KIND: pre-story-research
STORY_ID: ${storyId}

Read these two short reports and synthesize per your output schema:
- corpus_map: ${outDir}/corpus.md
- conventions_audit: ${outDir}/conventions.md
`;
  process.stdout.write("wave-research: synthesizing...\n");
  const rc = await runSynthesizer({
    binary,
    templatePath: `${internalDir}/synthesize.md`,
    taskInput: synthInput,
    outputPath: `${outDir}/synthesis.md`,
    errPath: `${outDir}/synthesis.err`
  });
  if (rc !== 0) {
    process.stderr.write(`WARN: synthesize sub-agent failed (rc=${rc}).
`);
    await writeSynthesizerFallback(
      `${outDir}/synthesis.md`,
      storyId,
      [`${outDir}/corpus.md`, `${outDir}/conventions.md`]
    );
  }
  await tidyErrFiles(outDir);
  process.stdout.write(`wave-research: done \u2192 ${outDir}/synthesis.md
`);
  return 0;
};
var code = await main();
process.exit(code);
