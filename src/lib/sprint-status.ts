// sprint-status.yaml IO. Read via parser (yaml package). Write via regex
// line-substitution to preserve the file's structure & comments — same
// approach as the previous Python helper.

import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'yaml';

export interface SprintStatus {
  development_status: Record<string, string>;
  dependencies: Record<string, string[]>;
}

const STORY_RE = /^story-\d+-\d+$/;

export const load = (path: string): SprintStatus => {
  const text = readFileSync(path, 'utf8');
  const data = (parse(text) ?? {}) as Partial<SprintStatus>;
  return {
    development_status: data.development_status ?? {},
    dependencies: data.dependencies ?? {},
  };
};

export const storyStatus = (s: SprintStatus, id: string): string =>
  s.development_status[id] ?? 'missing';

// Returns the next story id to process, or null when the sprint is done.
// Priority 1: a story already in flight (in-progress / review).
// Priority 2: backlog / ready-for-dev with all dependencies done.
export const nextStory = (s: SprintStatus): string | null => {
  const ds = s.development_status;
  for (const [sid, status] of Object.entries(ds)) {
    if (!STORY_RE.test(sid)) continue;
    if (status === 'in-progress' || status === 'review') return sid;
  }
  const doneIds = new Set(
    Object.entries(ds)
      .filter(([sid, st]) => STORY_RE.test(sid) && st === 'done')
      .map(([sid]) => sid),
  );
  for (const [sid, status] of Object.entries(ds)) {
    if (!STORY_RE.test(sid)) continue;
    if (status !== 'backlog' && status !== 'ready-for-dev') continue;
    const deps = s.dependencies[sid] ?? [];
    if (deps.every((d) => doneIds.has(d))) return sid;
  }
  return null;
};

// In-place line substitution. Preserves the rest of the file byte-for-byte.
// Returns true on a successful replacement, false when the id wasn't found.
export const forceStatus = (
  path: string,
  storyId: string,
  newStatus: string,
): boolean => {
  const text = readFileSync(path, 'utf8');
  const escaped = storyId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^(\\s*${escaped}:\\s*)\\S+\\s*$`, 'm');
  let replaced = false;
  const next = text.replace(re, (_match, prefix: string) => {
    replaced = true;
    return prefix + newStatus;
  });
  if (!replaced) return false;
  writeFileSync(path, next);
  return true;
};

export const countByStatus = (s: SprintStatus): {
  done: number;
  inFlight: number;
  ready: number;
  backlog: number;
  total: number;
} => {
  const stories = Object.entries(s.development_status).filter(([sid]) =>
    STORY_RE.test(sid),
  );
  let done = 0, inFlight = 0, ready = 0, backlog = 0;
  for (const [, st] of stories) {
    if (st === 'done') done++;
    else if (st === 'in-progress' || st === 'review') inFlight++;
    else if (st === 'ready-for-dev') ready++;
    else if (st === 'backlog') backlog++;
  }
  return { done, inFlight, ready, backlog, total: stories.length };
};

// First epic with an active story, else first non-done epic.
export const currentEpic = (s: SprintStatus): {
  id: string;
  status: string;
  done: number;
  total: number;
} | null => {
  const ds = s.development_status;
  let epicId: string | null = null;
  for (const [sid, st] of Object.entries(ds)) {
    const m = sid.match(/^story-(\d+)-\d+$/);
    if (m && (st === 'in-progress' || st === 'review' || st === 'ready-for-dev')) {
      epicId = `epic-${(m[1] ?? '').padStart(3, '0')}`;
      break;
    }
  }
  if (epicId === null) {
    for (const [k, v] of Object.entries(ds)) {
      if (/^epic-\d+$/.test(k) && v !== 'done') {
        epicId = k;
        break;
      }
    }
  }
  if (epicId === null) return null;
  const num = epicId.replace(/^epic-/, '');
  const epicStories = Object.entries(ds).filter(([sid]) => {
    const m = sid.match(/^story-(\d+)-\d+$/);
    return m !== null && (m[1] ?? '').padStart(3, '0') === num;
  });
  const done = epicStories.filter(([, st]) => st === 'done').length;
  return {
    id: epicId,
    status: ds[epicId] ?? '?',
    done,
    total: epicStories.length,
  };
};
