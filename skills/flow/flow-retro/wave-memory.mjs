#!/usr/bin/env node

// src/wave-memory.ts
import { existsSync, readdirSync } from "node:fs";
import { readFile as readFile2, writeFile as writeFile2 } from "node:fs/promises";

// src/lib/wave.ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
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

// src/lib/markdown.ts
var parseSections = (text) => {
  const out = /* @__PURE__ */ new Map();
  const parts = text.split(/^##\s+SECTION:\s+(\w+)\s*$/m);
  for (let i = 1; i < parts.length; i += 2) {
    const name = (parts[i] ?? "").trim().toLowerCase();
    const body = (parts[i + 1] ?? "").trim();
    out.set(name, body);
  }
  return out;
};

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
var piBinary = () => process.env["PI_BIN"] ?? "pi";
var isParallelEnabled = () => process.env["FLOW_PARALLEL"] !== "0";

// src/wave-memory.ts
var today = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
var findEpicFile = (epicId) => {
  const dir = ".agents/planning/epics";
  if (!existsSync(dir)) return null;
  const entries = readdirSync(dir);
  for (const name of entries) {
    if (name.startsWith(`${epicId}-`) && name.endsWith(".md")) {
      return `${dir}/${name}`;
    }
    if (name === `${epicId}.md`) return `${dir}/${name}`;
  }
  return null;
};
var ensureFile = async (path, header) => {
  if (!existsSync(path)) await writeFile2(path, `# ${header}

`);
};
var appendBlock = async (path, header, body, epicId, date, attribution) => {
  await ensureFile(path, header);
  const current = await readFile2(path, "utf8");
  const block = `
## ${date} \u2014 ${epicId} (${attribution})

${body}
`;
  await writeFile2(path, current + block);
};
var appendDecisions = async (path, body) => {
  await ensureFile(path, "Decisions (ADR-style)");
  const current = await readFile2(path, "utf8");
  const existing = /* @__PURE__ */ new Set();
  const titleRe = /^###\s+\S+\s+—\s+(.+)$/gm;
  let m;
  while ((m = titleRe.exec(current)) !== null) {
    existing.add((m[1] ?? "").trim().toLowerCase());
  }
  const entries = body.split(/(?=^###\s)/m).map((s) => s.trim()).filter(Boolean);
  const kept = [];
  const oneTitleRe = /^###\s+\S+\s+—\s+(.+)$/m;
  for (const entry of entries) {
    const t = oneTitleRe.exec(entry);
    if (t !== null && existing.has((t[1] ?? "").trim().toLowerCase())) continue;
    kept.push(entry);
  }
  if (kept.length > 0) {
    await writeFile2(path, current + "\n" + kept.join("\n\n") + "\n");
  }
};
var appendLessons = async (path, body, epicId, date) => {
  await ensureFile(path, "Lessons");
  const current = await readFile2(path, "utf8");
  const existing = /* @__PURE__ */ new Set();
  const re = /^-\s+\*\*(.+?)\*\*/gm;
  let m;
  while ((m = re.exec(current)) !== null) {
    existing.add((m[1] ?? "").trim().toLowerCase());
  }
  const oneRe = /^-\s+\*\*(.+?)\*\*/;
  const fresh = [];
  for (const line of body.split("\n")) {
    const t = oneRe.exec(line.trim());
    if (t !== null && existing.has((t[1] ?? "").trim().toLowerCase())) continue;
    fresh.push(line);
  }
  const joined = fresh.join("\n").trim();
  if (joined.length > 0) {
    await writeFile2(path, current + `
## ${date} \u2014 ${epicId}

${joined}
`);
  }
};
var appendGlossary = async (path, body) => {
  await ensureFile(path, "Glossary");
  const current = await readFile2(path, "utf8");
  const existing = /* @__PURE__ */ new Set();
  const re = /^-\s+\*\*(.+?)\*\*/gm;
  let m;
  while ((m = re.exec(current)) !== null) {
    existing.add((m[1] ?? "").trim().toLowerCase());
  }
  const oneRe = /^-\s+\*\*(.+?)\*\*/;
  const fresh = [];
  for (const line of body.split("\n")) {
    const t = oneRe.exec(line.trim());
    if (t === null) continue;
    if (existing.has((t[1] ?? "").trim().toLowerCase())) continue;
    fresh.push(line);
  }
  if (fresh.length > 0) {
    await writeFile2(path, current + "\n" + fresh.join("\n") + "\n");
  }
};
var replaceOverview = async (path, body, epicId, date) => {
  await ensureFile(path, "Overview");
  const current = await readFile2(path, "utf8");
  const archived = current.replace(
    /^##\s+État actuel\s+—\s+(\S+)\s+\(post-\S+\)\s*$/gm,
    (_m, d) => `## \xC9tat au ${d}`
  );
  const block = `
## \xC9tat actuel \u2014 ${date} (post-${epicId})

${body}
`;
  await writeFile2(path, archived + block);
};
var main = async () => {
  const epicId = process.argv[2];
  const retroPath = process.argv[3];
  if (typeof epicId !== "string" || epicId === "" || typeof retroPath !== "string" || retroPath === "") {
    process.stderr.write("usage: wave-memory.mjs <epic-id> <retro-path>\n");
    return 1;
  }
  if (!isParallelEnabled()) {
    process.stdout.write("wave-memory: skipped (FLOW_PARALLEL=0)\n");
    return 0;
  }
  if (!existsSync(retroPath)) {
    process.stderr.write(`ERROR: retro file not found: ${retroPath}
`);
    return 1;
  }
  const internalDir = flowInternalDir(import.meta.url);
  const memoryDir = ".agents/memory";
  const workDir = `.agents/internal/${epicId}-memory`;
  const epicFile = findEpicFile(epicId);
  if (epicFile === null) {
    process.stderr.write(
      `ERROR: cannot find epic file for ${epicId} under .agents/planning/epics/
`
    );
    return 1;
  }
  await ensureDir(memoryDir);
  await ensureDir(workDir);
  const date = today();
  const epicNum = epicId.replace(/^epic-/, "");
  const condenserTemplate = `${internalDir}/memory-condenser.md`;
  if (!existsSync(condenserTemplate)) {
    process.stderr.write(`ERROR: missing ${condenserTemplate}
`);
    return 1;
  }
  const prompt = await readFile2(condenserTemplate, "utf8");
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
    `Condense per your output schema. The wave script parses on '## SECTION: <name>' markers.`
  ].join("\n");
  process.stdout.write(`wave-memory: condensing ${epicId}...
`);
  const outFile = `${workDir}/condensation.md`;
  const errFile = `${workDir}/condensation.err`;
  const rc = await runPiSubAgent({
    binary: piBinary(),
    systemPrompt: prompt,
    taskInput,
    outputFile: outFile,
    errFile
  });
  if (rc !== 0) {
    process.stderr.write(
      `WARN: memory-condenser failed (rc=${rc}). See ${errFile}
wave-memory: aborted, memory unchanged.
`
    );
    return 0;
  }
  const condensation = await readFile2(outFile, "utf8");
  const sections = parseSections(condensation);
  const changed = [];
  const overview = sections.get("overview");
  if (overview !== void 0 && overview.toLowerCase() !== "no change") {
    await replaceOverview(`${memoryDir}/overview.md`, overview, epicId, date);
    changed.push("overview.md");
  }
  const decisions = sections.get("decisions");
  if (decisions !== void 0 && decisions.toLowerCase() !== "no change") {
    await appendDecisions(`${memoryDir}/decisions.md`, decisions);
    changed.push("decisions.md");
  }
  const lessons = sections.get("lessons");
  if (lessons !== void 0 && lessons.toLowerCase() !== "no change") {
    await appendLessons(`${memoryDir}/lessons.md`, lessons, epicId, date);
    changed.push("lessons.md");
  }
  const glossary = sections.get("glossary");
  if (glossary !== void 0 && glossary.toLowerCase() !== "no change") {
    await appendGlossary(`${memoryDir}/glossary.md`, glossary);
    changed.push("glossary.md");
  }
  const journal = sections.get("journal");
  if (journal !== void 0 && journal.toLowerCase() !== "no change") {
    await appendBlock(
      `${memoryDir}/journal.md`,
      "Journal",
      journal,
      epicId,
      date,
      "closeout"
    );
    changed.push("journal.md");
  }
  process.stdout.write(
    `wave-memory: updated ${changed.length} file(s): ${changed.length > 0 ? changed.join(", ") : "(none)"}
`
  );
  await cleanupEmptyErrFiles(workDir);
  process.stdout.write(`wave-memory: done \u2192 ${memoryDir}/
`);
  return 0;
};
var code = await main();
process.exit(code);
