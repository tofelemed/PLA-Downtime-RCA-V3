#!/usr/bin/env node
// `npm run ci`: runs scripts/ci.ps1 on Windows and scripts/ci.sh elsewhere, forwarding the flags
// (--e2e, --skip-lint, --skip-unit, --skip-int) in each shell's own spelling.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const flags = process.argv.slice(2);
const isWindows = process.platform === 'win32';

const powershellFlags = {
  '--e2e': '-E2E',
  '--skip-lint': '-SkipLint',
  '--skip-unit': '-SkipUnit',
  '--skip-int': '-SkipInt',
};

const command = isWindows ? 'powershell' : 'bash';
const args = isWindows
  ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(here, 'ci.ps1'), ...flags.map((f) => powershellFlags[f] ?? f)]
  : [path.join(here, 'ci.sh'), ...flags];

const result = spawnSync(command, args, { stdio: 'inherit' });
process.exit(result.status ?? 1);
