// apps/mobile/scripts/check-bundle-size.mjs · CI bundle-size gate (MOBILE_AI_AGENT_BUILD_GUIDE §5: keep the install
// small). Exports the production Hermes JS bundle with the Expo CLI and fails the build if it exceeds the budget.
// Run in CI after install; no secrets needed. Budget is the JS bundle (not the whole APK/AAB) — a fast proxy that
// catches a runaway dependency before it bloats the install. Override with MOBILE_BUNDLE_BUDGET_KB.
import { execSync } from 'node:child_process';
import { mkdtempSync, readdirSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BUDGET_KB = Number(process.env.MOBILE_BUNDLE_BUDGET_KB || 6000); // ~6 MB JS budget (Hermes bytecode is smaller)
const out = mkdtempSync(join(tmpdir(), 'kv-bundle-'));

try {
  // Export the production JS bundle for Android (Hermes). Expo writes the bundle(s) under <out>/_expo/static/js.
  execSync(`npx expo export --platform android --output-dir "${out}"`, { stdio: 'inherit', env: { ...process.env, EXPO_PUBLIC_APP_ENV: 'production' } });

  let total = 0;
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(hbc|js|bundle)$/.test(e.name)) total += statSync(p).size;
    }
  };
  walk(out);

  const kb = Math.round(total / 1024);
  if (kb === 0) { console.error('bundle-size: no JS/Hermes bundle found in export — failing.'); process.exit(1); }
  console.log(`bundle-size: JS bundle = ${kb} KB (budget ${BUDGET_KB} KB)`);
  if (kb > BUDGET_KB) { console.error(`bundle-size: OVER BUDGET by ${kb - BUDGET_KB} KB — trim a dependency or lazy-load it (§5).`); process.exit(1); }
  console.log('bundle-size: within budget ✓');
} finally {
  try { rmSync(out, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
}
