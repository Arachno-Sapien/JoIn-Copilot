#!/usr/bin/env node
// Gate runner for driver-written acceptance tests.
//
//   node scripts/gates/check.mjs <gate-id> <kind> [target] [extra args...]
//
// Kinds and their working directory:
//   pytest      backend/    uv run --locked pytest (network limited to localhost via pytest-socket)
//   vitest      extension/  npx vitest run
//   playwright  extension/  npx playwright test
//   typecheck   extension/  npx tsc --noEmit (no target)
//
// Prints "GATE OK <gate-id>" only when the command exits 0, at least one test
// passed, and nothing was skipped, todo, xfail or flaky. Every run forces mock
// LLM and fake embeddings and strips API keys from the environment, so a gate
// can never reach a live model or job API.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const KINDS = {
  pytest: ["backend", ["uv", "run", "--locked", "pytest", "-q", "-rs", "-p", "no:cacheprovider",
    "--allow-hosts=127.0.0.1,localhost,::1"]],
  vitest: ["extension", ["npx", "--no-install", "vitest", "run"]],
  playwright: ["extension", ["npx", "--no-install", "playwright", "test"]],
  typecheck: ["extension", ["npx", "--no-install", "tsc", "--noEmit"]],
};
const TEST_KINDS = new Set(["pytest", "vitest", "playwright"]);
const SECRET_NAME = /(_API_KEY|_APP_KEY|_APP_ID|_SECRET|_TOKEN|_PASSWORD)$/i;

export function scrubEnv(env) {
  const out = {};
  for (const [key, value] of Object.entries(env)) if (!SECRET_NAME.test(key)) out[key] = value;
  return { ...out, JC_LLM_MODE: "mock", JC_EMBED_MODE: "fake", JC_SCHEDULER: "off",
    NO_COLOR: "1", FORCE_COLOR: "0", CI: "1" };
}

// Returns null when the run counts as a pass, otherwise the reason it does not.
export function judge(kind, status, output) {
  if (status !== 0) return "command exited " + status;
  if (!TEST_KINDS.has(kind)) return null;
  const text = output.replace(/\x1b\[[0-9;]*m/g, "");
  if (!/\b[1-9]\d* passed\b/.test(text)) return "no passing tests reported";
  const bad = text.match(/\b[1-9]\d* (skipped|xfailed|todo|flaky)\b/);
  return bad ? bad[0] + " (gates allow no skipped, todo, xfail or flaky tests)" : null;
}

// npx/npm are .cmd shims on Windows, so they need a shell there, and cmd.exe
// needs quoting for arguments with spaces or metacharacters.
function winQuote(arg) {
  return /[\s"&|<>^()]/.test(arg) ? '"' + arg.replace(/"/g, '""') + '"' : arg;
}

export function spawnPortable(command, options) {
  const win = process.platform === "win32";
  return spawnSync(win ? command.map(winQuote).join(" ") : command[0], win ? [] : command.slice(1), {
    encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options, shell: win,
  });
}

function main(argv) {
  const [id, kind, ...args] = argv;
  if (!id || !KINDS[kind]) {
    console.error("usage: check.mjs <gate-id> <" + Object.keys(KINDS).join("|") + "> [target] [args...]");
    return 2;
  }
  const [dir, base] = KINDS[kind];
  const cwd = join(REPO, dir);
  const target = args.find((arg) => !arg.startsWith("-"));
  if (target && !existsSync(join(cwd, target.split("::")[0]))) {
    console.log("GATE FAIL " + id + ": acceptance test not written yet: " + dir + "/" + target);
    return 1;
  }
  const run = spawnPortable([...base, ...args], { cwd, env: scrubEnv(process.env) });
  const output = (run.stdout || "") + (run.stderr || "") + (run.error ? String(run.error) : "");
  // Keep the transcript well under gate-check's 1 MiB output ceiling.
  console.log(output.split(/\r?\n/).slice(-150).join("\n"));
  const reason = judge(kind, run.error ? -1 : run.status ?? -1, output);
  if (reason) {
    console.log("GATE FAIL " + id + ": " + reason);
    return 1;
  }
  console.log("GATE OK " + id);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv.slice(2));
