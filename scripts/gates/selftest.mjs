#!/usr/bin/env node
// Positive and negative controls for scripts/gates: every oracle must fail on a
// known violation and on an empty tree, and pass on a clean fixture. Prints
// "SELFTEST OK" only when all controls hold. docker-smoke is not covered
// because it needs a running Docker daemon.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { judge, scrubEnv } from "./check.mjs";
import { globToRegExp } from "./oracles.mjs";

const ORACLES = join(dirname(fileURLToPath(import.meta.url)), "oracles.mjs");
const TMP = mkdtempSync(join(tmpdir(), "jc-gates-"));
let fixtures = 0;

function tree(files) {
  const root = join(TMP, String(fixtures++));
  mkdirSync(root, { recursive: true });
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), body);
  }
  return root;
}
function oracle(root, args) {
  const run = spawnSync(process.execPath, [ORACLES, ...args, "--root", root, "--no-build"], { encoding: "utf8" });
  return { ok: run.status === 0 && /ORACLE OK/.test(run.stdout), out: run.stdout + run.stderr };
}
const passes = (root, ...args) => { const r = oracle(root, args); assert.ok(r.ok, args.join(" ") + " should pass:\n" + r.out); };
const fails = (root, ...args) => { const r = oracle(root, args); assert.ok(!r.ok, args.join(" ") + " should fail:\n" + r.out); };
const git = (root, ...args) => {
  const run = spawnSync("git", ["-c", "user.email=gate@test", "-c", "user.name=gate", ...args], { cwd: root, encoding: "utf8" });
  assert.equal(run.status, 0, "git " + args.join(" ") + ": " + run.stderr);
};

try {
  // check.mjs: pass only with passing tests and nothing skipped.
  assert.equal(judge("pytest", 0, "3 passed in 0.12s"), null);
  assert.equal(judge("vitest", 0, "\x1b[32m Tests  4 passed\x1b[39m (4)"), null);
  assert.equal(judge("typecheck", 0, ""), null);
  assert.match(judge("pytest", 1, "1 failed, 2 passed"), /exited 1/);
  assert.match(judge("pytest", 0, "2 passed, 1 skipped in 0.1s"), /skipped/);
  assert.match(judge("vitest", 0, " Tests  2 passed | 1 todo (3)"), /todo/);
  assert.match(judge("vitest", 0, " Tests  0 passed (0)"), /no passing tests/);
  assert.match(judge("playwright", 0, "1 flaky\n  3 passed (5.2s)"), /flaky/);
  const env = scrubEnv({ OPENAI_API_KEY: "x", ADZUNA_APP_ID: "y", GITHUB_TOKEN: "z", PATH: "p", JC_LLM_MODE: "live" });
  assert.deepEqual([env.OPENAI_API_KEY, env.ADZUNA_APP_ID, env.GITHUB_TOKEN, env.PATH, env.JC_LLM_MODE], [undefined, undefined, undefined, "p", "mock"]);

  // OWNS glob semantics.
  assert.ok(globToRegExp("backend/app/*.py").test("backend/app/main.py"));
  assert.ok(!globToRegExp("backend/app/*.py").test("backend/app/api/health.py"));
  assert.ok(globToRegExp("extension/tests/unit/tracker/**").test("extension/tests/unit/tracker/a/b.test.ts"));
  assert.ok(globToRegExp("backend/app/prompts/parse_resume*").test("backend/app/prompts/parse_resume.v1.md"));

  // no-auto-submit
  const cleanFill = { "extension/adapters/greenhouse.ts": 'el.dispatchEvent(new Event("input", { bubbles: true }));\n',
    "extension/entrypoints/content/index.ts": "export default {};\n",
    "extension/adapters/greenhouse.test.ts": "form.requestSubmit();\n" };
  passes(tree(cleanFill), "no-auto-submit");
  fails(tree({}), "no-auto-submit");
  for (const bad of ["form.requestSubmit();", "form.submit();", "submitButton.click();",
    'form.dispatchEvent(new Event("submit"));', "if (isSubmit(btn)) btn.click();"]) {
    fails(tree({ ...cleanFill, "extension/lib/fill.ts": bad + "\n" }), "no-auto-submit");
  }

  // extension-build (manifest checks only)
  const manifest = { manifest_version: 3, side_panel: { default_path: "sidepanel.html" }, background: { service_worker: "background.js" },
    permissions: ["sidePanel", "storage"], host_permissions: ["https://jobs.lever.co/*"],
    content_scripts: [{ matches: ["https://boards.greenhouse.io/*"], all_frames: true }] };
  const build = (m) => tree({ "extension/.output/chrome-mv3/manifest.json": JSON.stringify(m),
    "extension/.output/chrome-mv3/sidepanel.html": "<html></html>", "extension/.output/chrome-mv3/background.js": "1;" });
  passes(build(manifest), "extension-build");
  fails(tree({}), "extension-build");
  fails(build({ ...manifest, host_permissions: ["<all_urls>"] }), "extension-build");
  fails(build({ ...manifest, permissions: ["sidePanel", "tabs"] }), "extension-build");
  fails(build({ ...manifest, oauth2: { scopes: ["https://mail.google.com/"] } }), "extension-build");
  fails(build({ ...manifest, side_panel: undefined }), "extension-build");

  // no-keys-in-extension
  const bundle = { "extension/.output/chrome-mv3/background.js": "fetch(url);\n", "extension/lib/api/client.ts": "export {};\n" };
  passes(tree(bundle), "no-keys-in-extension");
  fails(tree({}), "no-keys-in-extension");
  fails(tree({ ...bundle, "extension/.output/chrome-mv3/background.js": 'const k="sk-proj-abcdefghijklmnopqrstuvwx";\n' }), "no-keys-in-extension");
  fails(tree({ ...bundle, "extension/lib/api/client.ts": "const k = import.meta.env.OPENAI_API_KEY;\n" }), "no-keys-in-extension");

  // non-goals
  const backend = { "backend/app/services/jobs/greenhouse.py": 'URL = "https://boards-api.greenhouse.io/v1/boards"\n',
    "backend/app/llm/client.py": "resp = completion(model=model, messages=messages)\n" };
  passes(tree(backend), "non-goals");
  fails(tree({}), "non-goals");
  fails(tree({ ...backend, "backend/app/services/jobs/li.py": 'URL = "https://www.linkedin.com/jobs"\n' }), "non-goals");
  fails(tree({ ...backend, "backend/app/llm/client.py": "resp = completion(model=m, tools=[apply])\n" }), "non-goals");

  // mv3-worker
  passes(tree({ "extension/entrypoints/background/index.ts": 'chrome.alarms.create("sync", { periodInMinutes: 180 });\n' }), "mv3-worker");
  fails(tree({}), "mv3-worker");
  fails(tree({ "extension/entrypoints/background/index.ts": "setInterval(sync, 60000);\n" }), "mv3-worker");

  // scaffold
  const scaffold = { LICENSE: "MIT", "README.md": "# x", "CONTRIBUTING.md": "x", ".gitignore": ".env\n.unlazy/\n",
    ".env.example": "JC_LLM_SMALL_MODEL=\nJC_LLM_STRONG_MODEL=\nOPENAI_API_KEY=\n",
    ".github/dependabot.yml": "version: 2", ".github/workflows/ci.yml": "on: push", ".github/ISSUE_TEMPLATE/adapter.md": "x",
    "backend/uv.lock": "x", "backend/.python-version": "3.12\n" };
  passes(tree(scaffold), "scaffold");
  fails(tree({ ...scaffold, ".env.example": "JC_LLM_SMALL_MODEL=\nJC_LLM_STRONG_MODEL=\nOPENAI_API_KEY=sk-123\n" }), "scaffold");
  fails(tree({ ...scaffold, LICENSE: "" }), "scaffold");
  fails(tree({ ...scaffold, ".gitignore": "node_modules/\n" }), "scaffold");

  // plan
  const ledger = (owns, ids) => "# Gates: x\n\n" + (owns ? "OWNS: " + owns + "\n\n" : "") +
    ids.map((id) => "- [ ] " + id + ": outcome\n  EVIDENCE: pending\n").join("\n");
  const plan = (rows, inventory) => ({
    ".unlazy/job-copilot/PLAN.md": "# Plan\n\n## Tree\n\n- 1 Root .... GATES.md\n  - 1.1 B .... gates/node-1.1.md\n" +
      "    - 1.1.1 A .... gates/leaf-1.1.1.md\n    - 1.1.2 B .... gates/leaf-1.1.2.md\n\n" +
      "| Leaf | Owns | Needs | Tier | Planned wave | State |\n|---|---|---|---|---|---|\n" + rows.join("\n") + "\n\n" +
      "| ID | Outcome | Owner | Observing | Disposition | Revision |\n|---|---|---|---|---|---|\n" + inventory.join("\n") + "\n",
    ".unlazy/job-copilot/GATES.md": ledger(null, ["G1"]),
    ".unlazy/job-copilot/gates/node-1.1.md": ledger(null, ["N1"]),
    ".unlazy/job-copilot/gates/leaf-1.1.1.md": ledger("src/a/**, tests/a/**", ["G0", "G1"]),
    ".unlazy/job-copilot/gates/leaf-1.1.2.md": ledger("src/b/**", ["G0", "G1"]),
  });
  const goodRows = ["| 1.1.1 | src/a/**, tests/a/** | - | judgment | 1 | READY |", "| 1.1.2 | src/b/** | 1.1.1 | mechanical | 2 | WAITING |"];
  const goodInventory = ["| C1 | outcome | leaf-1.1.1 | leaf-1.1.1:G1, GATES:G1 | ACTIVE | 1 |"];
  passes(tree(plan(goodRows, goodInventory)), "plan");
  fails(tree({}), "plan");
  fails(tree(plan([goodRows[0], "| 1.1.2 | src/b/** | 1.1.1 | mechanical | 1 | WAITING |"], goodInventory)), "plan");
  fails(tree(plan([goodRows[0], "| 1.1.2 | src/c/** | 1.1.1 | mechanical | 2 | WAITING |"], goodInventory)), "plan");
  fails(tree(plan([goodRows[0], "| 1.1.2 | src/b/** | 1.1.1 | mechanical | 2 | READY |"], goodInventory)), "plan");
  fails(tree(plan(goodRows, ["| C1 | outcome | leaf-1.1.1 | leaf-1.1.1:G9 | ACTIVE | 1 |"])), "plan");
  fails(tree(plan(goodRows, ["| C1 | outcome | leaf-1.1.1 | manual review | ACTIVE | 1 |"])), "plan");
  fails(tree(plan(goodRows, [...goodInventory, "| C2 | outcome | owner | - | OWNER_DECISION | 1 |"])), "plan");

  // owns-diff: writes inside OWNS pass, writes outside fail, the end tag bounds the range.
  const repo = tree({ ".gitignore": ".unlazy/\n", "README.md": "x\n",
    ".unlazy/job-copilot/gates/leaf-1.1.1.md": ledger("src/**", ["G0"]) });
  git(repo, "init", "-q");
  fails(repo, "owns-diff", "leaf-1.1.1");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "base");
  git(repo, "tag", "unlazy/leaf-1.1.1/start");
  writeFileSync(join(repo, ".unlazy/job-copilot/gates/leaf-1.1.1.md"), ledger("src/**", ["G0"]) + "\n");
  mkdirSync(join(repo, "src"));
  writeFileSync(join(repo, "src/a.ts"), "export {};\n");
  passes(repo, "owns-diff", "leaf-1.1.1");
  writeFileSync(join(repo, "README.md"), "changed\n");
  fails(repo, "owns-diff", "leaf-1.1.1");
  writeFileSync(join(repo, "README.md"), "x\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "leaf");
  git(repo, "tag", "unlazy/leaf-1.1.1/end");
  writeFileSync(join(repo, "README.md"), "later work by another leaf\n");
  passes(repo, "owns-diff", "leaf-1.1.1");

  console.log("SELFTEST OK");
} finally {
  rmSync(TMP, { recursive: true, force: true });
}
