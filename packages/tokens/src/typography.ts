// @krishi-verse/tokens · typography. The font stack carries Indic scripts (Devanagari/Gujarati) so Hindi/
// Marathi/Gujarati render correctly out of the box (mirrors languages.font_stack in the DB).
export const fontFamily = {
  sans: "'Noto Sans', 'Noto Sans Devanagari', 'Noto Sans Gujarati', system-ui, sans-serif",
  mono: "'Noto Sans Mono', ui-monospace, monospace",
} as const;
export const fontSize = { xs: '12px', sm: '14px', base: '16px', lg: '18px', xl: '22px', '2xl': '28px', '3xl': '36px' } as const;
export const fontWeight = { regular: 400, medium: 500, semibold: 600, bold: 700 } as const;
export const lineHeight = { tight: 1.2, normal: 1.5, relaxed: 1.7 } as const;   // relaxed default aids low-literacy readability
