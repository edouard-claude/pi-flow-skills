#!/usr/bin/env node

// src/wave-dev.ts
import { existsSync as existsSync2 } from "node:fs";
import { readFile as readFile2 } from "node:fs/promises";

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

// src/wave-dev.ts
var extractSection = (text, headerRe) => {
  const lines = text.split("\n");
  const out = [];
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
var extractTouchedPaths = (storyText) => {
  const block = extractSection(storyText, /^##\s+Files to touch/i);
  const re = /^\s*-\s+(CREATE|UPDATE|DELETE):\s*([^\s—-]+)/;
  const paths = [];
  for (const line of block) {
    const m = re.exec(line);
    if (m !== null && m[2] !== void 0) paths.push(m[2]);
  }
  return paths;
};
var extractImplPatterns = (storyText) => {
  const block = extractSection(storyText, /^##\s+Implementation plan/i);
  const re = /^\s*\d+\.\s*(.+)$/;
  const patterns = [];
  for (const line of block) {
    const m = re.exec(line);
    if (m !== null && m[1] !== void 0) patterns.push(m[1].trim());
    if (patterns.length >= 10) break;
  }
  return patterns;
};
var main = async () => {
  const storyId = process.argv[2];
  if (typeof storyId !== "string" || storyId === "") {
    process.stderr.write("usage: wave-dev.mjs <story-id>\n");
    return 1;
  }
  const internalDir = flowInternalDir(import.meta.url);
  const storyPath = `.agents/implementation/stories/${storyId}.md`;
  const statusPath = ".agents/implementation/sprint-status.yaml";
  const outDir = `.agents/internal/${storyId}-dev`;
  await ensureDir(outDir);
  if (!isParallelEnabled()) {
    await writeSkippedSynthesis(
      `${outDir}/synthesis.md`,
      storyId,
      "Parent proceeds with red-green-refactor directly from the story file."
    );
    process.stdout.write("wave-dev: skipped (FLOW_PARALLEL=0)\n");
    return 0;
  }
  if (!existsSync2(storyPath)) {
    process.stderr.write(`ERROR: story file not found: ${storyPath}
`);
    return 1;
  }
  const storyText = await readFile2(storyPath, "utf8");
  const touched = extractTouchedPaths(storyText);
  const impl = extractImplPatterns(storyText);
  const binary = piBinary();
  const simInput = `STORY_ID: ${storyId}
STORY_PATH: ${storyPath}
IMPL_PATTERNS:
` + impl.map((p) => `- ${p}`).join("\n") + `

Scan for prior art per your output schema.`;
  const depsInput = `STORY_ID: ${storyId}
STORY_PATH: ${storyPath}
STATUS_PATH: ${statusPath}
STORIES_DIR: .agents/implementation/stories/

Map coupling per your output schema.`;
  const testsInput = `STORY_ID: ${storyId}
STORY_PATH: ${storyPath}
TOUCHED_PATHS:
` + touched.join("\n") + `

Inventory tests per your output schema.`;
  process.stdout.write(
    "wave-dev: spawning similar-impl + dependencies + tests sub-agents in parallel...\n"
  );
  const results = await runInParallel(binary, outDir, [
    {
      name: "similar-impl",
      templatePath: `${internalDir}/find-similar-impl.md`,
      taskInput: simInput
    },
    {
      name: "dependencies",
      templatePath: `${internalDir}/check-dependencies.md`,
      taskInput: depsInput
    },
    {
      name: "tests",
      templatePath: `${internalDir}/enumerate-tests.md`,
      taskInput: testsInput
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
  const synthInput = `WAVE_KIND: pre-dev-research
STORY_ID: ${storyId}

Read these three sub-agent reports and synthesize per your output schema.
Emphasis: surface concrete reuse opportunities and coupling risks the implementer
must acknowledge before the red-green-refactor loop.
- similar-impl: ${outDir}/similar-impl.md
- dependencies: ${outDir}/dependencies.md
- tests: ${outDir}/tests.md
`;
  process.stdout.write("wave-dev: synthesizing...\n");
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
      [`${outDir}/similar-impl.md`, `${outDir}/dependencies.md`, `${outDir}/tests.md`]
    );
  }
  await tidyErrFiles(outDir);
  process.stdout.write(`wave-dev: done \u2192 ${outDir}/synthesis.md
`);
  return 0;
};
var code = await main();
process.exit(code);
