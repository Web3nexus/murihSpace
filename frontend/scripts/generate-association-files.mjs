#!/usr/bin/env node
/**
 * Regenerates the Universal Links / App Links association files from the real
 * signing identities.
 *
 * Both files live in `public/.well-known/` and are copied verbatim into the
 * built bundle, so they must match the certificate the app is actually signed
 * with. A mismatch does not error — Android simply fails `autoVerify`
 * silently and opens the browser instead of the app, so regenerate these
 * whenever a keystore or Apple team changes.
 *
 * The two signing identities are read from `.env` (see `.env.example`), so a
 * regeneration after a team or keystore change is one command:
 *
 *   # Android — prints the SHA256 fingerprint of a keystore
 *   keytool -list -v -keystore upload-keystore.jks -alias upload \
 *     | grep SHA256
 *
 *   npm run links:write          # regenerate from .env
 *   npm run links                # print what is currently committed
 *
 * Flags override `.env` for the run, and an already-exported variable beats
 * both, so CI can inject the values without a checkout of `.env`:
 *
 *   node scripts/generate-association-files.mjs \
 *     --android-fingerprint "AA:BB:..." \
 *     --ios-team-id ABCDE12345
 *
 * With neither flags nor `--write` it prints the current values found in the
 * files, which is handy for confirming what is deployed.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wellKnown = join(root, "public", ".well-known");

const aasaPath = join(wellKnown, "apple-app-site-association");
// Apple also probes the root of the host, so the same document ships there
// too. Both copies must come from this one `APP_COMPONENTS` list — a hand
// maintained copy drifts back to the catch-all this script exists to forbid.
const legacyAasaPath = join(root, "public", "apple-app-site-association");
const aasaPaths = [aasaPath, legacyAasaPath];
const assetLinksPath = join(wellKnown, "assetlinks.json");

/**
 * Path shapes the mobile app can actually route. Mirrors DeepLinks.
 *
 * Two rules govern this list:
 *
 * 1. Only claim paths the app really handles. An over-broad claim is worse than
 *    no claim: the OS opens the app, the app has no matching route, and the
 *    user gets a dead screen instead of the web page.
 * 2. No `query` key. Omitting it makes a component match *any* query string,
 *    which is what we want — share links carry tracking and referral params —
 *    whereas `"query": { "?*": "?*" }` is not a reliable Apple wildcard and can
 *    stop real links from matching at all.
 *
 * There is deliberately no catch-all `{ "/": "*" }` component. Apple scopes
 * Universal Links by these path patterns, so claiming everything would make the
 * app swallow every URL on the host, including marketing pages it cannot route.
 */
const APP_COMPONENTS = [
  // Canonical share paths
  { "/": "/live", comment: "Live landing" },
  { "/": "/live/*", comment: "Live session share link" },
  { "/": "/m/*", comment: "Meeting invite" },
  { "/": "/e/*", comment: "Event share link" },
  { "/": "/p/*", comment: "Product share link" },
  { "/": "/chat/*", comment: "Chat share link" },
  { "/": "/u/*", comment: "Public profile" },
  { "/": "/c/*", comment: "Community" },
  { "/": "/l/*", comment: "Link in bio" },
  { "/": "/store/*", comment: "Creator storefront" },
  // Legacy aliases still emitted by older builds and shares
  { "/": "/meeting/*", comment: "Legacy meeting alias" },
  { "/": "/meetings/*", comment: "Legacy meeting alias" },
  { "/": "/events/*", comment: "Legacy event alias" },
  { "/": "/products/*", comment: "Legacy product alias" },
  { "/": "/conversation/*", comment: "Legacy conversation alias" },
  { "/": "/communities/*", comment: "Legacy community alias" },
  { "/": "/community/*", comment: "Legacy community alias" },
  { "/": "/bio/*", comment: "Legacy link-in-bio alias" },
  // In-app routes that are also reachable as links
  { "/": "/app/meeting/*", comment: "In-app meeting route" },
  { "/": "/app/meetings/*", comment: "In-app meetings route" },
  { "/": "/app/conversation/*", comment: "In-app conversation route" },
  { "/": "/app/community/*", comment: "In-app community route" },
];

/**
 * Minimal `.env` reader — the script must not gain a dependency just to read
 * four lines. Later files win, matching Vite's own loading order, and a value
 * already in `process.env` beats every file.
 */
const ENV_FILES = [".env", ".env.local", ".env.production", ".env.production.local"];

function loadEnvFiles() {
  const fromFiles = {};
  for (const name of ENV_FILES) {
    const path = join(root, name);
    let contents;
    try {
      contents = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    for (const line of contents.split(/\r?\n/)) {
      const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      fromFiles[match[1]] = value;
    }
  }
  return fromFiles;
}

const envFiles = loadEnvFiles();

/** Resolves a signing identity from `.env`, or an exported variable over it. */
function fromEnv(key) {
  const exported = process.env[key];
  if (exported !== undefined && exported !== "") return exported.trim();
  const value = envFiles[key];
  return value !== undefined && value !== "" ? value.trim() : undefined;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

// `--write` (or `npm run links:write`) is what makes `.env` authoritative.
// Without it, only explicit flags change anything, so a bare run stays a read.
const useEnv = Boolean(args["write"]);
const resolve = (flag, envKey) => (args[flag] ?? (useEnv ? fromEnv(envKey) : undefined));

const packageName = resolve("android-package", "ANDROID_PACKAGE") ?? "com.murihspace.mobile";
const rawFingerprints = resolve("android-fingerprint", "ANDROID_FINGERPRINT");
const teamId = resolve("ios-team-id", "IOS_TEAM_ID");
const bundleId = resolve("ios-bundle-id", "IOS_BUNDLE_ID") ?? "com.murihspace.mobile";

// ── Report only ───────────────────────────────────────────────────
// Any flag at all is a request for a change, so none of them may be
// swallowed by the read-only path.
const flagOnly = !useEnv;
const requested =
  args["android-fingerprint"] || args["ios-team-id"] || args["android-package"] || args["ios-bundle-id"];

if (flagOnly && !requested) {
  console.log("Current apple-app-site-association:");
  console.log(readFileSync(aasaPath, "utf8"));
  console.log("\nCurrent assetlinks.json:");
  console.log(readFileSync(assetLinksPath, "utf8"));
  console.log(
    "\nNo changes made. Run `npm run links:write` to regenerate from .env, or pass --android-fingerprint / --ios-team-id / --android-package / --ios-bundle-id.",
  );
  process.exit(0);
}

// ── Android ───────────────────────────────────────────────────────
if (rawFingerprints) {
  const fingerprints = (Array.isArray(rawFingerprints) ? rawFingerprints : [rawFingerprints])
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean)
    .map((value) =>
      value.includes(":") ? value : value.match(/.{2}/g)?.join(":") ?? value,
    );

  const invalid = fingerprints.filter((value) => !/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(value));
  if (invalid.length > 0) {
    console.error(`Not a valid SHA-256 fingerprint: ${invalid.join(", ")}`);
    process.exit(1);
  }

  writeFileSync(
    assetLinksPath,
    `${JSON.stringify(
      [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: packageName,
            sha256_cert_fingerprints: fingerprints,
          },
        },
      ],
      null,
      2,
    )}\n`,
  );
  console.log(`Wrote ${fingerprints.length} fingerprint(s) to assetlinks.json`);
} else if (args["android-package"]) {
  console.error(
    "`--android-package` also needs a fingerprint. Pass --android-fingerprint, or use `npm run links:write` so it comes from .env.",
  );
  process.exit(1);
} else {
  console.warn("ANDROID_FINGERPRINT not set: assetlinks.json left unchanged.");
}

// ── iOS ───────────────────────────────────────────────────────────
if (teamId) {
  const appId = `${teamId}.${bundleId}`;
  const document = `${JSON.stringify(
    {
      applinks: {
        apps: [],
        details: [
          {
            appIDs: [appId],
            components: APP_COMPONENTS,
          },
        ],
      },
      webcredentials: { apps: [appId] },
      appclips: { apps: [], details: [] },
    },
    null,
    2,
  )}\n`;
  for (const path of aasaPaths) {
    writeFileSync(path, document);
  }
  console.log(`Wrote appID ${appId} to ${aasaPaths.length} AASA copies`);
} else if (args["ios-bundle-id"]) {
  console.error(
    "`--ios-bundle-id` also needs a team ID. Pass --ios-team-id, or use `npm run links:write` so it comes from .env.",
  );
  process.exit(1);
} else {
  console.warn("IOS_TEAM_ID not set: apple-app-site-association left unchanged.");
}

console.log("\nVerify with:");
console.log("  curl -sI https://web.murihspace.com/.well-known/apple-app-site-association");
console.log("  curl -sI https://web.murihspace.com/apple-app-site-association");
console.log("  curl -s  https://web.murihspace.com/.well-known/assetlinks.json");

void execFileSync;