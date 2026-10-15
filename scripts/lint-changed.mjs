#!/usr/bin/env node
// `npm run lint:changed`: lints only the files changed against the main branch (committed on this branch,
// staged, unstaged and untracked), each with its own project's ESLint config (frontend at the root, the
// backend in server/pro-act-backend). Fails on errors; warnings (size and complexity rules, ENGINEERING
// _STANDARDS "Code quality") are printed but do not fail, so the ~2,400 pre-existing ones never block.
// Base branch: LINT_BASE (default origin/main, else main).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BACKEND = 'server/pro-act-backend/';
const LINTED = /\.(ts|tsx|js|mjs|cjs)$/;
const SKIPPED = [/^src\/components\/ui\//, /^src\/api\/v2\/schema\.d\.ts$/, /(^|\/)dist\//, /(^|\/)node_modules\//];

function git(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.split('\n').map((line) => line.trim()).filter(Boolean) : null;
}

function baseRef() {
  const candidates = [process.env.LINT_BASE, 'origin/main', 'main'].filter(Boolean);
  for (const ref of candidates) {
    const base = git(['merge-base', 'HEAD', ref]);
    if (base?.[0]) return base[0];
  }
  console.error(`lint:changed: no merge base with ${candidates.join(' / ')}; set LINT_BASE`);
  process.exit(2);
}

function changedFiles() {
  const base = baseRef();
  const lists = [
    git(['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`]),
    git(['diff', '--name-only', '--diff-filter=ACMR', 'HEAD']),
    git(['ls-files', '--others', '--exclude-standard']),
  ];
  const files = new Set(lists.flatMap((list) => list ?? []));
  return [...files].filter((file) => LINTED.test(file) && !SKIPPED.some((skip) => skip.test(file)) && existsSync(path.join(root, file)));
}

/** Files per ESLint run, so the command line stays under the Windows limit. */
const BATCH = 40;

function eslint(cwd, files) {
  if (files.length === 0) return 0;
  console.log(`\nESLint (${path.relative(root, cwd) || 'frontend'}): ${files.length} file(s)`);
  let status = 0;
  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);
    const result = spawnSync('npx', ['eslint', '--no-warn-ignored', ...batch], { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
    status = Math.max(status, result.status ?? 1);
  }
  return status;
}

const files = changedFiles();
const backend = files.filter((file) => file.startsWith(BACKEND)).map((file) => file.slice(BACKEND.length));
const frontend = files.filter((file) => !file.startsWith('server/'));
if (backend.length + frontend.length === 0) {
  console.log('lint:changed: no changed source files');
  process.exit(0);
}
const status = Math.max(eslint(root, frontend), eslint(path.join(root, BACKEND), backend));
process.exit(status === 0 ? 0 : 1);
