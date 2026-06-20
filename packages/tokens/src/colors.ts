// @krishi-verse/tokens · the design-system color palette as code (single source for every frontend). Synced
// from the design system (see sync-from-design-system.js). Agri-forward greens + earthy accents + semantic
// status colors. Values are hex; consume via CSS variables or Tailwind theme extension.
export const colors = {
  brand: { 50: '#f1f8e9', 100: '#dcedc8', 300: '#aed581', 500: '#558b2f', 600: '#4a7d2a', 700: '#33691e', 900: '#1b3d10' },
  earth: { 100: '#efebe9', 300: '#bcaaa4', 500: '#795548', 700: '#4e342e' },
  neutral: { 0: '#ffffff', 50: '#fafafa', 100: '#f5f5f5', 200: '#eeeeee', 400: '#bdbdbd', 600: '#757575', 800: '#424242', 900: '#212121' },
  status: { success: '#2e7d32', warning: '#f9a825', danger: '#c62828', info: '#1565c0' },
} as const;
export type ColorScale = typeof colors;
