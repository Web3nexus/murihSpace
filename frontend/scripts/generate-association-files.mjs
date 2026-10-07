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
 * Usage:
 *   # Android — prints the SHA256 fingerprint of a keystore
 *   keytool -list -v -keystore upload-keystore.jks -alias upload \
 *     | grep SHA256
 *
 *   node scripts/generate-association-files.mjs \
 *     --android-package com.murihspace.mobile \
 *     --android-fingerprint "AA:BB:..." \
 *     --ios-team-id ABCDE12345
 *
 * With no arguments it prints the current values found in the files, which is
 * handy for confirming what is deployed.
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

// ── Report only ───────────────────────────────────────────────────
if (!args["android-fingerprint"] && !args["ios-team-id"]) {
  console.log("Current apple-app-site-association:");
  console.log(readFileSync(aasaPath, "utf8"));
  console.log("\nCurrent assetlinks.json:");
  console.log(readFileSync(assetLinksPath, "utf8"));
  console.log(
    "\nNo changes made. Pass --android-fingerprint and/or --ios-team-id to rewrite.",
  );
  process.exit(0);
}

// ── Android ───────────────────────────────────────────────────────
const packageName = args["android-package"] ?? "com.murihspace.mobile";
const rawFingerprints = args["android-fingerprint"];
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
} else {
  console.warn("--android-fingerprint missing: assetlinks.json left unchanged.");
}

// ── iOS ───────────────────────────────────────────────────────────
const teamId = args["ios-team-id"];
const bundleId = args["ios-bundle-id"] ?? "com.murihspace.mobile";
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
} else {
  console.warn("--ios-team-id missing: apple-app-site-association left unchanged.");
}

console.log("\nVerify with:");
console.log("  curl -sI https://web.murihspace.com/.well-known/apple-app-site-association");
console.log("  curl -sI https://web.murihspace.com/apple-app-site-association");
console.log("  curl -s  https://web.murihspace.com/.well-known/assetlinks.json");

void execFileSync;