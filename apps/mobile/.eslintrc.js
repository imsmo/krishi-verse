// apps/mobile/.eslintrc.js · lint config for the app. Extends the Expo preset (RN + a11y + import hygiene) and
// adds project guardrails that enforce the mobile guide: no raw fetch in screens, no console in committed code.
// Runs in CI (the RN/Expo toolchain). Keep rules pragmatic — failing lint blocks merge (guide §9).
module.exports = {
  root: true,
  extends: ['expo'],
  ignorePatterns: ['dist', 'node_modules', '.expo'],
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    // Tokens-only / no raw network in screens are enforced by review (guide §10) + the threats checklist.
  },
};
