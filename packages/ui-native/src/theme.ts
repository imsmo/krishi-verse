// packages/ui-native/src/theme.ts · the single source of truth for the React Native design language, mirroring
// the Phase-1 design system tokens (Krishi_Verse_Design_System/system/tokens.css). RN can't read CSS variables,
// so the canonical palette/space/type scale lives here as plain constants. Every ui-native component and every
// mobile screen pulls from THIS — never a hardcoded hex/number — so a token change propagates everywhere.
//
// Palette: primary green (#1e6f3f main), accent gold (#f39c12), earth cream backgrounds, ink text, AI purple,
// and the semantic success/warning/danger/info ramps — verbatim from the design tokens.

export const color = {
  primary50: '#ecf6ee', primary100: '#c8e5ce', primary200: '#a4d4ae', primary300: '#7fc28e',
  primary400: '#5bb16e', primary500: '#38a04e', primary600: '#1e6f3f', primary700: '#195a34',
  primary800: '#134628', primary900: '#0e321c',

  accent50: '#fef6e7', accent100: '#fde6b8', accent200: '#fbd589', accent300: '#f9c45a',
  accent400: '#f7b32b', accent500: '#f39c12', accent600: '#cc810b', accent700: '#a56708',
  accent800: '#7e4d06', accent900: '#573303',

  earth50: '#faf7f0', earth100: '#f1ebdb', earth200: '#e7dfc6', earth300: '#d7cba8',
  earth400: '#bfb088', earth500: '#a8946a', earth600: '#8b7853', earth700: '#6c5e42',
  earth800: '#4d4330', earth900: '#2f2920',

  ink50: '#f5f6f7', ink100: '#e8eaed', ink200: '#ced2d8', ink300: '#a7afb9', ink400: '#707b88',
  ink500: '#4d5763', ink600: '#353d47', ink700: '#232a33', ink800: '#161c24', ink900: '#0a0e14',

  ai500: '#6c3483', ai700: '#50265f',

  successLight: '#d4ecd9', success: '#27ae60', successDark: '#1e8449',
  warningLight: '#fde6c4', warning: '#e67e22', warningDark: '#ba6018',
  dangerLight: '#f9d6d4', danger: '#c0392b', dangerDark: '#962d22',
  infoLight: '#d6e6f2', info: '#2874a6', infoDark: '#1f5a83',

  page: '#faf7f0', card: '#ffffff', overlay: 'rgba(35, 42, 51, 0.6)',
  white: '#ffffff', transparent: 'transparent',
} as const;

// 4-pt spacing scale (space-1 = 4px … space-12 = 48px), matching the design-system --space-* ramp.
export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

// Type scale. Display uses Fraunces; UI/body uses Plus Jakarta Sans; Hind covers Devanagari/Gujarati glyphs.
// (Fonts are loaded by the app at boot; these family names match what expo-font registers.)
export const font = {
  display: 'Fraunces', body: 'PlusJakartaSans', vernacular: 'Hind',
  size: { xs: 12, sm: 13, md: 15, lg: 17, xl: 20, '2xl': 24, '3xl': 30 },
  weight: { regular: '400', medium: '500', semibold: '600', bold: '700' },
} as const;

export const shadow = {
  // RN shadow (iOS) + elevation (Android) pair for a soft card lift.
  card: { shadowColor: '#1e6f3f', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  floating: { shadowColor: '#1e6f3f', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
} as const;

// Minimum touch target — accessibility + low-end-device usability (Phase-1 audience is rural, large fingers,
// outdoor sunlight). Never ship a tappable control smaller than this.
export const HIT_TARGET = 48;

export type ColorToken = keyof typeof color;
