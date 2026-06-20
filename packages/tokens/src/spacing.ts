// @krishi-verse/tokens · spacing + radii + breakpoints on a 4px base grid (rural-friendly: large touch targets).
export const spacing = { 0: '0', 1: '4px', 2: '8px', 3: '12px', 4: '16px', 5: '20px', 6: '24px', 8: '32px', 10: '40px', 12: '48px', 16: '64px' } as const;
export const radii = { none: '0', sm: '4px', md: '8px', lg: '12px', xl: '16px', full: '9999px' } as const;
export const breakpoints = { sm: '480px', md: '768px', lg: '1024px', xl: '1280px' } as const;
// Minimum 44px touch target (accessibility / low-end Android in the field).
export const touchTargetMinPx = 44;
