// apps/mobile/metro.config.js · Metro must be monorepo- AND pnpm-aware, or it can't resolve symlinked packages
// from the workspace store (e.g. `expo-router/entry`). This is the canonical Expo monorepo config plus the pnpm
// bits: watch the repo root, search both the app's and the root node_modules, and follow symlinks into the
// pnpm store (.pnpm/*). See https://docs.expo.dev/guides/monorepos/.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch the whole monorepo so changes in workspace packages are picked up.
config.watchFolders = [monorepoRoot];

// 2. Resolve modules from the app first, then the hoisted root store (pnpm puts the real packages under
//    <root>/node_modules/.pnpm and symlinks them into these node_modules dirs).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. pnpm uses symlinks heavily; let Metro follow them and walk up the tree to find hoisted deps.
config.resolver.unstable_enableSymlinks = true;
config.resolver.disableHierarchicalLookup = false;

// 4. Expo adds `db` to assetExts (for PREBUILT expo-sqlite database files). We don't bundle a .db asset — we open
//    SQLite at runtime — but we DO have a source module named `sqlite.db.ts`. With `db` as an asset ext, importing
//    `./sqlite.db` makes Metro hunt for a .db *asset* instead of the .ts source → "Unable to resolve". Drop `db`
//    from assetExts so the module resolves as source.
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== 'db');

module.exports = config;
