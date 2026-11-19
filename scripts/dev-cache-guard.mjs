// Runs before `npm run dev` (package.json "predev"). Clears ONLY the dev server's output and
// Turbopack cache (`.next/dev`) when the installed dependencies, Next.js, Node or the machine
// changed since the last dev run. A stale persistent Turbopack cache keeps paths of modules that
// are gone after `npm ci` / an upgrade, which shows up as "Cannot find module 'tapable'" or
// "'@vercel/turbopack/postcss'" (docs/plans/mac-dev-cache.md). Production builds (`.next` outside
// `dev/`, CI, Vercel) are never touched. `--force` clears regardless.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { arch, platform } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Everything that, when changed, makes the dev cache untrustworthy. */
export function fingerprint(input) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        input.lockfile,
        input.nextVersion,
        input.nodeVersion,
        input.platform,
        input.arch,
      ]),
    )
    .digest('hex');
}

/** Clear when forced, or when a dev cache exists and was built with a different fingerprint. */
export function shouldClear({ force, devDirExists, previous, current }) {
  if (force) return true;
  if (!devDirExists) return false;
  return previous !== current;
}

function readOr(path, fallback) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return fallback;
  }
}

function main() {
  // npm runs scripts from the package root.
  const root = process.cwd();
  const devDir = join(root, '.next', 'dev');
  const stampFile = join(root, '.next', '.dev-deps-stamp');
  const nextPkg = readOr(join(root, 'node_modules', 'next', 'package.json'), '{}');
  const current = fingerprint({
    lockfile: readOr(join(root, 'package-lock.json'), ''),
    nextVersion: JSON.parse(nextPkg).version ?? 'missing',
    nodeVersion: process.version,
    platform: platform(),
    arch: arch(),
  });
  const previous = readOr(stampFile, '').trim();
  const clear = shouldClear({
    force: process.argv.includes('--force'),
    devDirExists: existsSync(devDir),
    previous,
    current,
  });
  if (clear) {
    rmSync(devDir, { recursive: true, force: true });
    console.log(
      '[dev-cache-guard] Dependencies or Node changed: cleared .next/dev (dev cache only).',
    );
  }
  mkdirSync(join(root, '.next'), { recursive: true });
  writeFileSync(stampFile, `${current}\n`);
}

if (
  process.argv[1] &&
  import.meta.url.startsWith('file:') &&
  fileURLToPath(import.meta.url) === process.argv[1]
)
  main();
