#!/usr/bin/env node
// Static and smoke oracles for gates that are not acceptance-test files.
//
//   node scripts/gates/oracles.mjs <rule> [args] [--root DIR] [--no-build]
//
// A rule prints "ORACLE OK <rule> [args]" and exits 0 only when every assertion
// passes. A rule also fails when the code it scans is missing, so an empty tree
// never passes as "no violations". scripts/gates/selftest.mjs holds the
// positive and negative controls for every rule except docker-smoke.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnPortable } from "./check.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCOPE_DIR = ".unlazy/job-copilot";

// Changing either list is a plan amendment (PLAN.md contract; design §6.4).
export const ALLOWED_PERMISSIONS = ["sidePanel", "storage", "alarms", "identity", "activeTab", "scripting"];
export const ALLOWED_HOSTS = [
  "https://boards.greenhouse.io/*", "https://job-boards.greenhouse.io/*", "https://jobs.lever.co/*",
  "https://gmail.googleapis.com/*", "https://www.googleapis.com/*",
];
const BROAD_HOSTS = ["<all_urls>", "*://*/*", "http://*/*", "https://*/*"];
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const SKIP_DIRS = new Set(["node_modules", ".output", ".wxt", ".venv", "__pycache__", "dist", ".git"]);
const SOURCE = /\.(m?[jt]sx?|py)$/;
const TEST_FILE = /\.(test|spec)\.[jt]sx?$|(^|\/)test_[^/]*\.py$/;
const EXT_SOURCE_DIRS = ["extension/adapters", "extension/entrypoints", "extension/lib", "extension/components"];

const SUBMIT_PATTERNS = [
  ["requestSubmit call", (l) => /\brequestSubmit\s*\(/.test(l)],
  ["form.submit() call", (l) => /\.submit\s*\(\s*\)/.test(l)],
  ["synthetic submit event", (l) => /new\s+SubmitEvent\b|dispatchEvent\s*\(\s*new\s+(Custom)?Event\s*\(\s*['"`]submit/.test(l)],
  ["click on a submit control", (l) => /submit/i.test(l) && /\.click\s*\(/.test(l)],
];
const KEY_PATTERNS = [
  ["provider API key", (l) => /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/.test(l)],
  ["Google API key", (l) => /\bAIza[0-9A-Za-z_-]{35}\b/.test(l)],
  ["GitHub token", (l) => /\bgh[pousr]_[A-Za-z0-9]{36}\b/.test(l)],
  ["server secret name", (l) => /\b(?:OPENAI|ANTHROPIC|GEMINI|GROQ|MISTRAL|COHERE|ADZUNA|LITELLM)_[A-Z_]*(?:KEY|SECRET|APP_ID)\b|\bJC_LLM_[A-Z_]*KEY\b/.test(l)],
];

function walk(root, rel, filter = SOURCE) {
  const abs = join(root, rel);
  if (!existsSync(abs)) return [];
  if (statSync(abs).isFile()) return filter.test(rel) ? [rel] : [];
  const out = [];
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    out.push(...walk(root, rel + "/" + entry.name, filter));
  }
  return out;
}

function scanLines(root, files, patterns) {
  const hits = [];
  for (const file of files) {
    if (TEST_FILE.test(file)) continue;
    readFileSync(join(root, file), "utf8").split(/\r?\n/).forEach((line, index) => {
      const code = line.trim();
      if (/^(\/\/|\/\*|\*|#)/.test(code)) return;
      for (const [name, test] of patterns) {
        if (test(code)) hits.push(file + ":" + (index + 1) + ": " + name + ": " + code.slice(0, 160));
      }
    });
  }
  return hits;
}

const nothingIn = (root, dirs) => dirs.filter((rel) => !walk(root, rel).length).map((rel) => "nothing to scan in " + rel);
const normSet = (list) => new Set(list.split(",").map((s) => s.trim().replace(/\\/g, "/").replace(/^\.\//, "")).filter(Boolean));
const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
const tail = (run) => ((run.stdout || "") + (run.stderr || "") + (run.error || "")).slice(-1500);

export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      const dirStar = glob[i + 2] === "/";
      re += dirStar ? "(?:.*/)?" : ".*";
      i += dirStar ? 2 : 1;
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp("^" + re + "$");
}

function buildExtension(root) {
  const run = spawnPortable(["npm", "run", "build"], { cwd: join(root, "extension") });
  return run.status === 0 ? [] : ["npm run build failed in extension/: " + tail(run)];
}

const RULES = {
  // Design §13 and §11.3: open source files, CI, Dependabot, pinned Python, env template.
  scaffold(root) {
    const fails = [];
    const nonEmpty = (rel) => existsSync(join(root, rel)) && statSync(join(root, rel)).isFile() &&
      readFileSync(join(root, rel), "utf8").trim() !== "";
    for (const rel of ["LICENSE", "README.md", "CONTRIBUTING.md", ".env.example", ".gitignore",
      ".github/dependabot.yml", "backend/uv.lock", "backend/.python-version"]) {
      if (!nonEmpty(rel)) fails.push(rel + " is missing or empty");
    }
    if (!walk(root, ".github/workflows", /\.ya?ml$/).some(nonEmpty)) fails.push("no CI workflow in .github/workflows");
    if (!walk(root, ".github/ISSUE_TEMPLATE", /./).some(nonEmpty)) fails.push("no issue template in .github/ISSUE_TEMPLATE");
    if (nonEmpty(".env.example")) {
      const env = readFileSync(join(root, ".env.example"), "utf8");
      for (const name of ["JC_LLM_SMALL_MODEL", "JC_LLM_STRONG_MODEL"]) {
        if (!new RegExp("^" + name + "=", "m").test(env)) fails.push(".env.example does not declare " + name);
      }
      for (const m of env.matchAll(/^([A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD)[A-Z0-9_]*)=(.*)$/gm)) {
        if (m[2].trim()) fails.push(".env.example sets a value for secret " + m[1]);
      }
    }
    if (nonEmpty(".gitignore")) {
      const lines = readFileSync(join(root, ".gitignore"), "utf8").split(/\r?\n/).map((l) => l.trim());
      for (const need of [".env", ".unlazy/"]) if (!lines.includes(need)) fails.push(".gitignore does not ignore " + need);
    }
    if (nonEmpty("backend/.python-version") &&
      !readFileSync(join(root, "backend/.python-version"), "utf8").trim().startsWith("3.12")) {
      fails.push("backend/.python-version is not 3.12");
    }
    return fails;
  },

  // Design §2.5 and §4.2: one-command self-host, provider chosen by env. Needs Docker running.
  async "docker-smoke"(root) {
    const env = { ...process.env, JC_LLM_MODE: "mock" };
    const compose = (...args) => spawnSync("docker", ["compose", ...args], { cwd: root, env, encoding: "utf8" });
    const fails = [];
    // A pending fetch alone does not hold the event loop open (Node exited 13
    // mid-poll and skipped compose down), so keep a ref'd timer until done.
    const keepAlive = setInterval(() => {}, 1000);
    try {
      for (const step of [["build", "backend"], ["up", "-d", "backend"]]) {
        const run = compose(...step);
        if (run.status !== 0) return ["docker compose " + step.join(" ") + " failed: " + tail(run)];
      }
      let healthy = false;
      for (let i = 0; i < 60 && !healthy; i++) {
        try {
          healthy = (await fetch("http://127.0.0.1:8000/health", { signal: AbortSignal.timeout(3000) })).status === 200;
        } catch { /* not up yet */ }
        if (!healthy) await new Promise((done) => setTimeout(done, 2000));
      }
      if (!healthy) fails.push("backend container never answered GET http://127.0.0.1:8000/health with 200");
      const logs = compose("logs", "backend");
      if (/\bDownloading\b|\bInstalled \d+ packages?\b/.test((logs.stdout || "") + (logs.stderr || ""))) {
        fails.push("backend container installed packages at startup instead of using the image's locked environment");
      }
      let environment = {};
      try { environment = JSON.parse(compose("config", "--format", "json").stdout).services?.backend?.environment || {}; }
      catch { fails.push("docker compose config did not return JSON"); }
      for (const name of ["JC_LLM_SMALL_MODEL", "JC_LLM_STRONG_MODEL"]) {
        if (!(name in environment)) fails.push("docker compose does not pass " + name + " to the backend");
      }
    } finally {
      clearInterval(keepAlive);
      compose("down");
    }
    return fails;
  },

  // Design §6.4: MV3, side panel, minimal permissions, ATS-only hosts, gmail.readonly only.
  "extension-build"(root, args, opts) {
    const built = opts.noBuild ? [] : buildExtension(root);
    if (built.length) return built;
    const out = join(root, "extension/.output/chrome-mv3");
    if (!existsSync(join(out, "manifest.json"))) return ["no built manifest at extension/.output/chrome-mv3/manifest.json"];
    const m = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8"));
    const fails = [];
    if (m.manifest_version !== 3) fails.push("manifest_version is not 3");
    for (const [label, file] of [["side panel page", m.side_panel?.default_path], ["background service worker", m.background?.service_worker]]) {
      if (!file || !existsSync(join(out, file))) fails.push(label + " missing from build: " + file);
    }
    for (const p of [...(m.permissions || []), ...(m.optional_permissions || [])]) {
      if (!ALLOWED_PERMISSIONS.includes(p)) fails.push("permission not in allowlist: " + p);
    }
    const hosts = [...(m.host_permissions || []), ...(m.optional_host_permissions || []),
      ...(m.content_scripts || []).flatMap((c) => c.matches || [])];
    for (const h of hosts) {
      if (BROAD_HOSTS.includes(h)) fails.push("broad host pattern: " + h);
      else if (!ALLOWED_HOSTS.includes(h)) fails.push("host not in allowlist: " + h);
    }
    if (m.oauth2 && JSON.stringify(m.oauth2.scopes) !== JSON.stringify([GMAIL_SCOPE])) {
      fails.push("oauth2 scopes must be exactly " + GMAIL_SCOPE);
    }
    return fails;
  },

  // Design §2.3: no code path submits an application for the user.
  "no-auto-submit"(root) {
    const files = EXT_SOURCE_DIRS.flatMap((rel) => walk(root, rel));
    return nothingIn(root, ["extension/adapters", "extension/entrypoints/content"]).concat(scanLines(root, files, SUBMIT_PATTERNS));
  },

  // Design §11.2: API keys live on the backend, never in the extension source or bundle.
  "no-keys-in-extension"(root, args, opts) {
    const built = opts.noBuild ? [] : buildExtension(root);
    if (built.length) return built;
    const bundle = walk(root, "extension/.output/chrome-mv3", /\.(js|json|html)$/);
    if (!bundle.length) return ["no built bundle in extension/.output/chrome-mv3"];
    const source = EXT_SOURCE_DIRS.flatMap((rel) => walk(root, rel))
      .concat(walk(root, "extension", /(^|\/)(wxt\.config\.ts|\.env[^/]*)$/));
    return scanLines(root, [...bundle, ...source], KEY_PATTERNS);
  },

  // Design §2.2 and §15: no LinkedIn/Naukri access, no tool or function calling by the LLM.
  "non-goals"(root) {
    const backend = walk(root, "backend/app");
    const extension = EXT_SOURCE_DIRS.flatMap((rel) => walk(root, rel));
    return nothingIn(root, ["backend/app/services/jobs", "backend/app/llm"])
      .concat(scanLines(root, [...backend, ...extension],
        [["LinkedIn/Naukri access", (l) => /\b(linkedin|naukri)\.com\b/i.test(l)]]))
      .concat(scanLines(root, backend,
        [["LLM tool/function calling", (l) => /\btools\s*=|\btool_choice\b|\bfunctions\s*=|\bfunction_call\b/.test(l)]]));
  },

  // Design §6.2: the MV3 worker schedules with chrome.alarms, never setInterval.
  "mv3-worker"(root) {
    const files = walk(root, "extension/entrypoints/background").concat(walk(root, "extension/entrypoints/background.ts"));
    if (!files.length) return ["no background entrypoint under extension/entrypoints/background"];
    return scanLines(root, files, [["setInterval in the service worker (use chrome.alarms)", (l) => /\bsetInterval\s*\(/.test(l)]]);
  },

  // unlazy contract: tree, dispatch table, OWNS mirrors and inventory agree with the ledgers.
  plan(root) {
    const dir = join(root, SCOPE_DIR);
    if (!existsSync(join(dir, "PLAN.md"))) return ["missing " + SCOPE_DIR + "/PLAN.md"];
    const text = readFileSync(join(dir, "PLAN.md"), "utf8");
    const cache = new Map();
    const ledger = (stem) => {
      if (!cache.has(stem)) {
        const file = join(dir, stem === "GATES" ? "GATES.md" : "gates/" + stem + ".md");
        if (!existsSync(file)) cache.set(stem, null);
        else {
          const body = readFileSync(file, "utf8");
          const owns = body.match(/^OWNS:\s*(.*)$/m);
          cache.set(stem, { ids: new Set([...body.matchAll(/^- \[[ xX]\] ([A-Za-z0-9_.-]+):/gm)].map((m) => m[1])),
            owns: owns ? normSet(owns[1]) : null });
        }
      }
      return cache.get(stem);
    };
    const fails = [];
    const treeLines = text.split(/\r?\n/).filter((l) => /^\s*- \d+(\.\d+)* /.test(l));
    const treeLeaves = new Set();
    for (const line of treeLines) {
      const m = line.match(/(GATES|gates\/((?:leaf|node)-[\d.]+))\.md\s*$/);
      if (!m) { fails.push("tree line names no ledger: " + line.trim()); continue; }
      if (!ledger(m[2] || "GATES")) fails.push("tree names a missing ledger: " + m[0]);
      if (m[2]?.startsWith("leaf-")) treeLeaves.add(m[2].slice(5));
    }
    const rows = text.split(/\r?\n/).filter((l) => l.trim().startsWith("|"))
      .map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
    const dispatch = rows.filter((r) => /^\d+(\.\d+)+$/.test(r[0]) && r.length === 6);
    const byId = new Map(dispatch.map((r) => [r[0], { wave: Number(r[4]), state: r[5] }]));
    for (const id of treeLeaves) if (!byId.has(id)) fails.push("tree leaf " + id + " has no dispatch row");
    for (const id of byId.keys()) if (!treeLeaves.has(id)) fails.push("dispatch row " + id + " is not a tree leaf");
    for (const [id, owns, needs, tier, wave, state] of dispatch) {
      if (!["judgment", "mechanical"].includes(tier)) fails.push(id + ": Tier must be judgment or mechanical");
      if (!["WAITING", "READY", "IN-FLIGHT", "VERIFIED", "ABANDONED"].includes(state)) fails.push(id + ": unknown State " + state);
      if (!(Number(wave) >= 1 && Number.isInteger(Number(wave)))) fails.push(id + ": Planned wave must be a positive integer");
      const deps = needs === "-" ? [] : needs.split(",").map((s) => s.trim());
      for (const need of deps) {
        if (!byId.has(need)) fails.push(id + ": Needs unknown leaf " + need);
        else if (byId.get(need).wave >= Number(wave)) fails.push(id + ": Needs " + need + ", which is not in an earlier wave");
      }
      const ready = deps.every((need) => byId.get(need)?.state === "VERIFIED");
      if (state === "READY" && !ready) fails.push(id + ": READY while a dependency is not VERIFIED");
      if (state === "WAITING" && ready) fails.push(id + ": WAITING although every dependency is VERIFIED");
      const led = ledger("leaf-" + id);
      if (!led) fails.push(id + ": missing ledger gates/leaf-" + id + ".md");
      else if (!led.owns) fails.push(id + ": ledger has no OWNS header");
      else if (!sameSet(led.owns, normSet(owns))) fails.push(id + ": PLAN Owns differs from the ledger OWNS header");
    }
    const inventory = rows.filter((r) => /^C\d+$/.test(r[0]));
    if (!inventory.length) fails.push("contract inventory is empty");
    const open = [];
    for (const [id, outcome, owner, observing, disposition] of inventory) {
      if (disposition === "REMOVED_BY_USER") continue;
      if (["ABANDONED", "DEFERRED", "OWNER_DECISION"].includes(disposition)) { open.push(id + " " + disposition + ": " + outcome); continue; }
      if (disposition !== "ACTIVE") { fails.push(id + ": unknown disposition " + disposition); continue; }
      if (!owner || owner === "-") fails.push(id + ": no owner");
      const refs = [...(observing || "").matchAll(/\b((?:leaf|node)-\d+(?:\.\d+)*|GATES):([A-Z]+\d+)\b/g)];
      if (!refs.length) fails.push(id + ": no qualified observing gate");
      for (const [, stem, gate] of refs) {
        if (!ledger(stem)?.ids.has(gate)) fails.push(id + ": observing gate " + stem + ":" + gate + " does not exist");
      }
    }
    if (fails.length) return fails;
    console.log("PLAN STRUCTURE OK (" + treeLeaves.size + " leaves, " + inventory.length + " inventory rows)");
    return open.map((row) => "open, blocks completion: " + row);
  },

  // unlazy OWNS as a write contract: every file a leaf changed since its dispatch tag is inside its OWNS.
  "owns-diff"(root, [leaf]) {
    if (!/^leaf-\d+(\.\d+)+$/.test(leaf || "")) return ["usage: owns-diff leaf-<id>"];
    const file = join(root, SCOPE_DIR, "gates", leaf + ".md");
    if (!existsSync(file)) return ["missing ledger " + SCOPE_DIR + "/gates/" + leaf + ".md"];
    const owns = readFileSync(file, "utf8").match(/^OWNS:\s*(.*)$/m);
    if (!owns) return [leaf + " has no OWNS header"];
    const globs = [...normSet(owns[1])].map(globToRegExp);
    const git = (...args) => spawnSync("git", args, { cwd: root, encoding: "utf8" });
    const tag = (name) => "refs/tags/unlazy/" + leaf + "/" + name;
    if (git("rev-parse", "--verify", "--quiet", tag("start")).status !== 0) {
      return ["tag unlazy/" + leaf + "/start does not exist; the driver tags it right before dispatch"];
    }
    const ended = git("rev-parse", "--verify", "--quiet", tag("end")).status === 0;
    const diff = git("diff", "--name-only", "--no-renames", "-z", tag("start"), ...(ended ? [tag("end")] : []));
    if (diff.status !== 0) return ["git diff failed: " + tail(diff)];
    const files = diff.stdout.split("\0").filter(Boolean);
    if (!ended) files.push(...git("ls-files", "--others", "--exclude-standard", "-z").stdout.split("\0").filter(Boolean));
    return files.filter((f) => !globs.some((re) => re.test(f))).map((f) => "changed outside OWNS: " + f);
  },
};

async function main(argv) {
  const opts = { root: REPO, noBuild: false };
  const args = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--root") opts.root = resolve(argv[++i]);
    else if (argv[i] === "--no-build") opts.noBuild = true;
    else args.push(argv[i]);
  }
  const [rule, ...rest] = args;
  if (!RULES[rule]) {
    console.error("usage: oracles.mjs <" + Object.keys(RULES).join("|") + "> [args] [--root DIR] [--no-build]");
    return 2;
  }
  const fails = await RULES[rule](opts.root, rest, opts);
  const label = [rule, ...rest].join(" ");
  if (fails.length) {
    console.log(fails.join("\n"));
    console.log("ORACLE FAIL " + label + " (" + fails.length + ")");
    return 1;
  }
  console.log("ORACLE OK " + label);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main(process.argv.slice(2));
