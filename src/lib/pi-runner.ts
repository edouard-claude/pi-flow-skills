// Spawn pi sub-processes. Two modes:
//   - runPiPhase: live event streaming (json mode), parsed line-by-line,
//     formatted via the markdown beautifier, written to the parent stderr.
//   - runPiSubAgent: capture stdout into a file (wave agents).

import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { open, writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { transformMarkdownLine } from './markdown.js';

export interface PiPhaseOptions {
  binary: string;
  phase: string;          // e.g. flow-story
  story: string;          // story id (or any positional arg)
  systemPrompt: string;
  mode: 'json' | 'text';
  raw?: boolean;          // bypass jq-equivalent, dump JSON lines unformatted
}

export const runPiPhase = async (opts: PiPhaseOptions): Promise<number> => {
  const args = [
    '--print',
    '--no-session',
    '--mode', opts.mode,
    '--append-system-prompt', opts.systemPrompt,
    `/${opts.phase} ${opts.story}`,
  ];

  return new Promise<number>((resolve) => {
    const child = spawn(opts.binary, args, {
      stdio: ['ignore', 'pipe', 'inherit'],
      env: process.env,
    });

    if (opts.mode !== 'json' || opts.raw === true) {
      // Passthrough — write stdout straight to parent stderr.
      child.stdout.on('data', (chunk: Buffer) => process.stderr.write(chunk));
      child.on('close', (code) => resolve(code ?? 1));
      return;
    }

    // jq-equivalent line-by-line event parsing.
    let buf = '';
    let lineBuf = '';  // markdown formatter is line-anchored
    const flushLine = (line: string): void => {
      process.stderr.write(transformMarkdownLine(line));
    };
    child.stdout.on('data', (chunk: Buffer) => {
      buf += chunk.toString('utf8');
      let nl: number;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const raw = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        const fragment = piEventToText(raw);
        if (fragment === '') continue;
        lineBuf += fragment;
        let i: number;
        while ((i = lineBuf.indexOf('\n')) !== -1) {
          flushLine(lineBuf.slice(0, i + 1));
          lineBuf = lineBuf.slice(i + 1);
        }
      }
    });
    child.on('close', (code) => {
      if (lineBuf.length > 0) flushLine(lineBuf);
      resolve(code ?? 1);
    });
  });
};

// Mirror of the previous jq formatter:
//   thinking_delta / text_delta → emit the delta
//   tool_use_start              → newline + [TOOL: name] + newline
//   tool_use_complete           → newline + [/TOOL] + newline
//   message_complete            → "\n\n"
//   anything else               → empty
const piEventToText = (jsonLine: string): string => {
  if (jsonLine.trim() === '') return '';
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(jsonLine) as Record<string, unknown>;
  } catch {
    return '';
  }
  const evt = (obj['assistantMessageEvent'] ?? {}) as Record<string, unknown>;
  const t = typeof evt['type'] === 'string' ? (evt['type'] as string) : null;
  if (t === 'thinking_delta' || t === 'text_delta') {
    const d = evt['delta'];
    return typeof d === 'string' ? d : '';
  }
  if (t === 'tool_use_start') {
    const direct = typeof evt['name'] === 'string' ? (evt['name'] as string) : null;
    const tool = (evt['tool'] ?? {}) as Record<string, unknown>;
    const nested = typeof tool['name'] === 'string' ? (tool['name'] as string) : null;
    const name = direct ?? nested ?? '?';
    return `\n\n[TOOL: ${name}]\n`;
  }
  if (t === 'tool_use_complete') {
    return '\n[/TOOL]\n';
  }
  if (obj['type'] === 'message_complete') {
    return '\n\n';
  }
  return '';
};

export interface PiSubAgentOptions {
  binary: string;
  systemPrompt: string;
  taskInput: string;
  outputFile: string;
  errFile: string;
}

// Captures stdout into outputFile, stderr into errFile, returns the exit code.
export const runPiSubAgent = async (opts: PiSubAgentOptions): Promise<number> => {
  const out = createWriteStream(opts.outputFile);
  const err = createWriteStream(opts.errFile);
  return new Promise<number>((resolve) => {
    const child = spawn(opts.binary, [
      '--print',
      '--no-session',
      '--append-system-prompt', opts.systemPrompt,
      opts.taskInput,
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    child.stdout.pipe(out);
    child.stderr.pipe(err);
    child.on('close', (code) => {
      out.end();
      err.end();
      resolve(code ?? 1);
    });
  });
};

// Minimal preflight: pi binary present + responds to a no-op invocation
// without "Failed to load extension". Returns null on success, error text otherwise.
export const piPreflight = async (binary: string): Promise<string | null> => {
  return new Promise<string | null>((resolve) => {
    const child = spawn(binary, ['--print', '--no-session', '-p', 'exit'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    let combined = '';
    child.stdout.on('data', (c: Buffer) => { combined += c.toString('utf8'); });
    child.stderr.on('data', (c: Buffer) => { combined += c.toString('utf8'); });
    child.on('error', (e) => resolve(`pi binary error: ${e.message}`));
    child.on('close', () => {
      if (combined.includes('Failed to load extension')) {
        const offenders = combined
          .split('\n')
          .filter((l) => l.includes('Failed to load extension') || l.startsWith('Error'))
          .join('\n');
        resolve(`pi reports broken extensions:\n${offenders}`);
        return;
      }
      resolve(null);
    });
  });
};

// Atomic helper: write a small string to a file, creating dirs as needed.
export const writeIfChanged = async (path: string, content: string): Promise<void> => {
  await writeFile(path, content);
};

// Strip empty .err files in the given directory.
export const cleanupEmptyErrFiles = async (dir: string): Promise<void> => {
  const { readdir, stat, unlink } = await import('node:fs/promises');
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (!name.endsWith('.err')) continue;
    const full = `${dir}/${name}`;
    try {
      const s = await stat(full);
      if (s.size === 0) await unlink(full);
    } catch {
      // ignore
    }
  }
};

// touch helper used by the preflight code that opened files conditionally.
export const ensureFile = async (path: string): Promise<void> => {
  const fh = await open(path, 'a');
  await fh.close();
};
