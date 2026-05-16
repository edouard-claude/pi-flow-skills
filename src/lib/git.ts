// Minimal git helpers. Synchronous because they are tiny one-shots invoked
// before the main async work begins.

import { spawnSync } from 'node:child_process';

const runGitNames = (args: string[]): string[] => {
  const r = spawnSync('git', args, { encoding: 'utf8' });
  if (r.status !== 0 || typeof r.stdout !== 'string') return [];
  return r.stdout
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
};

// Files changed in the working tree + index, deduped, sorted.
export const gitChangedPaths = (): string[] => {
  const all = [
    ...runGitNames(['diff', '--name-only', 'HEAD']),
    ...runGitNames(['diff', '--name-only', '--cached']),
  ];
  return Array.from(new Set(all)).sort();
};

// Age of HEAD commit in seconds. Returns null if not a git repo or empty repo.
export const headCommitAgeSeconds = (): number | null => {
  const r = spawnSync('git', ['log', '-1', '--format=%ct'], { encoding: 'utf8' });
  if (r.status !== 0 || typeof r.stdout !== 'string') return null;
  const ts = parseInt(r.stdout.trim(), 10);
  if (Number.isNaN(ts)) return null;
  return Math.floor(Date.now() / 1000) - ts;
};
