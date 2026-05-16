#!/usr/bin/env node
// Bundles each TypeScript entry point into a self-contained ESM .mjs file
// committed in place under skills/. Includes the yaml dependency inline so
// the user needs nothing beyond the node bundled with pi.

import { build } from 'esbuild';
import { chmod } from 'node:fs/promises';

const ENTRIES = [
  { in: 'src/flow-auto.ts',     out: 'skills/flow/flow-auto/run.mjs' },
  { in: 'src/wave-research.ts', out: 'skills/flow/flow-story/wave-research.mjs' },
  { in: 'src/wave-dev.ts',      out: 'skills/flow/flow-dev/wave-dev.mjs' },
  { in: 'src/wave-review.ts',   out: 'skills/flow/flow-review/wave-review.mjs' },
  { in: 'src/wave-memory.ts',   out: 'skills/flow/flow-retro/wave-memory.mjs' },
];

const SHEBANG = '#!/usr/bin/env node\n';

for (const e of ENTRIES) {
  const start = Date.now();
  await build({
    entryPoints: [e.in],
    outfile: e.out,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    banner: { js: SHEBANG.trimEnd() },
    legalComments: 'none',
    minify: false,
    sourcemap: false,
    logLevel: 'warning',
  });
  await chmod(e.out, 0o755);
  const ms = Date.now() - start;
  console.log(`  ${e.out}  (${ms}ms)`);
}

console.log(`built ${ENTRIES.length} bundles`);
