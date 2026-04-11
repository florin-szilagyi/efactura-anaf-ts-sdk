#!/usr/bin/env node
/**
 * Build a Node Single Executable Application (SEA) for the anaf-cli.
 *
 * By default this builds for the current platform/arch using the currently-
 * running node binary as the source executable. CI invokes this with
 * explicit `--node-binary <path>` and `--output <path>` for cross-platform
 * artifact production (Node runtimes for each target OS/arch must be
 * pre-downloaded and cached by the workflow — see .github/workflows/release.yml).
 *
 * Reference: https://nodejs.org/api/single-executable-applications.html
 *
 * Required inputs:
 *   - cli/dist/bin/anaf-cli.cjs (produced by `pnpm run build:bundle`)
 *   - A node binary to inject into (defaults to process.execPath)
 *
 * Output:
 *   - A runnable standalone executable at the path passed via --output or
 *     at a sensible default derived from the target platform.
 *
 * Requirements on the host:
 *   - Node 20 or newer for --experimental-sea-config is NOT required on
 *     20.x — the API is stable. CI pins exact minor for reproducibility.
 *   - `postject` is available as a dep (installed on demand via npx).
 *   - On macOS, `codesign` (Apple toolchain) must be available for binary
 *     signing post-injection. Linux: no signing needed.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(here, '..');

// ─── arg parsing ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function optionValue(name) {
  const idx = args.indexOf(name);
  if (idx === -1 || idx === args.length - 1) return undefined;
  return args[idx + 1];
}

const bundlePath = optionValue('--bundle') ?? path.join(cliRoot, 'dist', 'bin', 'anaf-cli.cjs');
const nodeBinaryPath = optionValue('--node-binary') ?? process.execPath;
const defaultOutName = process.platform === 'win32' ? 'anaf-cli.exe' : 'anaf-cli';
const outPath =
  optionValue('--output') ??
  path.join(cliRoot, 'dist', 'sea', `${process.platform}-${process.arch}`, defaultOutName);

if (!fs.existsSync(bundlePath)) {
  console.error(`build-sea: bundle not found at ${bundlePath}`);
  console.error('Run `pnpm --filter anaf-cli run build:bundle` first.');
  process.exit(1);
}
if (!fs.existsSync(nodeBinaryPath)) {
  console.error(`build-sea: node binary not found at ${nodeBinaryPath}`);
  process.exit(1);
}

// ─── SEA config ─────────────────────────────────────────────────────────
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anaf-cli-sea-'));
const seaConfigPath = path.join(workDir, 'sea-config.json');
const blobPath = path.join(workDir, 'anaf-cli.blob');

const seaConfig = {
  main: bundlePath,
  output: blobPath,
  disableExperimentalSEAWarning: true,
};
fs.writeFileSync(seaConfigPath, JSON.stringify(seaConfig, null, 2));

// ─── generate the SEA blob ──────────────────────────────────────────────
console.log(`build-sea: generating SEA blob at ${blobPath}`);
execFileSync(nodeBinaryPath, ['--experimental-sea-config', seaConfigPath], {
  stdio: 'inherit',
  cwd: cliRoot,
});

// ─── copy the node binary to the output path ────────────────────────────
fs.mkdirSync(path.dirname(outPath), { recursive: true });
console.log(`build-sea: copying ${nodeBinaryPath} -> ${outPath}`);
fs.copyFileSync(nodeBinaryPath, outPath);
fs.chmodSync(outPath, 0o755);

// On macOS, the code signature must be stripped before postject injection,
// then re-signed after. On Linux/Windows this step is a no-op.
if (process.platform === 'darwin') {
  console.log('build-sea: removing macOS code signature prior to injection');
  try {
    execFileSync('codesign', ['--remove-signature', outPath], { stdio: 'inherit' });
  } catch (err) {
    console.error(`build-sea: codesign --remove-signature failed: ${err.message}`);
    console.error('On macOS, Xcode command line tools are required. Continuing anyway.');
  }
}

// ─── inject the blob via postject ───────────────────────────────────────
// postject is invoked via npx so we don't need a top-level dev dep.
console.log('build-sea: injecting SEA blob via postject');
const postjectArgs = [
  '--yes',
  'postject',
  outPath,
  'NODE_SEA_BLOB',
  blobPath,
  '--sentinel-fuse',
  'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
];
if (process.platform === 'darwin') {
  postjectArgs.push('--macho-segment-name', 'NODE_SEA');
}
execFileSync('npx', postjectArgs, { stdio: 'inherit', cwd: cliRoot });

// ─── re-sign on macOS ───────────────────────────────────────────────────
if (process.platform === 'darwin') {
  console.log('build-sea: re-signing macOS binary with ad-hoc signature');
  try {
    execFileSync('codesign', ['--sign', '-', outPath], { stdio: 'inherit' });
  } catch (err) {
    console.error(`build-sea: codesign failed: ${err.message}`);
    console.error('The binary may not run on macOS Gatekeeper without a real signature.');
  }
}

// ─── smoke test the resulting binary ────────────────────────────────────
console.log('build-sea: smoke test (--version)');
try {
  const out = execFileSync(outPath, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  const version = out.trim();
  console.log(`build-sea: success — ${outPath} reports version ${version}`);
} catch (err) {
  console.error(`build-sea: smoke test FAILED: ${err.message}`);
  process.exit(1);
}

// ─── cleanup temp ──────────────────────────────────────────────────────
fs.rmSync(workDir, { recursive: true, force: true });

console.log(`build-sea: ${outPath}`);
