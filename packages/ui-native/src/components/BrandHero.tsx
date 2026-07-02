// packages/ui-native/src/components/BrandHero.tsx · the Welcome (screen 01) hero illustration — a faithful port
// of the design's farmer-with-phone-in-field vector (Krishi_Verse_Design_System/screens/01-welcome.html, viewBox
// 0 0 260 260) to react-native-svg. Brand greens/gold/page pull from theme tokens; a couple of illustration-only
// tones (skin/turban shading) are literal artwork colours (not UI chrome). Decorative → a11y-hidden.
import React from 'react';
import Svg, { Path, Circle, G, Rect } from 'react-native-svg';
import { color } from '../theme';

const SKIN = '#C49B6E';
const FIELD_LINE = '#0E4A28';
const TURBAN_SHADE = color.accent700; // #a56708

export interface BrandHeroProps { size?: number }

export function BrandHero({ size = 240 }: BrandHeroProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 260 260" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* sun */}
      <Circle cx={200} cy={60} r={28} fill={color.accent500} />
      <Circle cx={200} cy={60} r={36} fill={color.accent500} opacity={0.25} />

      {/* field */}
      <Path d="M0 200 Q130 175 260 200 L260 260 L0 260 Z" fill={color.primary600} />
      <Path d="M0 215 Q130 195 260 215" stroke={FIELD_LINE} strokeWidth={2} fill="none" opacity={0.4} />
      <Path d="M0 230 Q130 215 260 230" stroke={FIELD_LINE} strokeWidth={2} fill="none" opacity={0.4} />
      <Path d="M0 245 Q130 230 260 245" stroke={FIELD_LINE} strokeWidth={2} fill="none" opacity={0.4} />

      {/* wheat stalks */}
      <G transform="translate(40,150)" stroke={color.accent500} strokeWidth={2.5} fill="none" strokeLinecap="round">
        <Path d="M0 50 L0 10" /><Path d="M0 15 Q-6 18 -6 25" /><Path d="M0 15 Q6 18 6 25" />
        <Path d="M0 25 Q-6 28 -6 35" /><Path d="M0 25 Q6 28 6 35" />
      </G>
      <G transform="translate(215,155)" stroke={color.accent500} strokeWidth={2.5} fill="none" strokeLinecap="round">
        <Path d="M0 50 L0 10" /><Path d="M0 15 Q-6 18 -6 25" /><Path d="M0 15 Q6 18 6 25" />
        <Path d="M0 25 Q-6 28 -6 35" /><Path d="M0 25 Q6 28 6 35" />
      </G>

      {/* farmer */}
      <G transform="translate(105,80)">
        {/* legs/dhoti */}
        <Path d="M15 130 L20 175 L30 175 L28 135 Z" fill={color.primary900} />
        <Path d="M35 130 L30 175 L40 175 L42 135 Z" fill={color.primary900} />
        {/* kurta */}
        <Path d="M5 60 Q5 50 15 48 L40 48 Q50 50 50 60 L50 135 L5 135 Z" fill={color.page} stroke={color.earth600} strokeWidth={1} />
        {/* arms */}
        <Path d="M5 65 Q-5 80 0 105 Q3 110 8 108 L12 80 Z" fill={color.page} stroke={color.earth600} strokeWidth={1} />
        <Path d="M50 65 Q60 80 60 100 Q57 108 52 110 L43 80 Z" fill={color.page} stroke={color.earth600} strokeWidth={1} />
        {/* neck */}
        <Rect x={22} y={40} width={11} height={12} fill={SKIN} />
        {/* head */}
        <Circle cx={28} cy={30} r={16} fill={SKIN} />
        {/* turban */}
        <Path d="M12 25 Q28 8 44 25 Q44 18 28 12 Q12 18 12 25 Z" fill={color.accent500} />
        <Path d="M13 28 Q28 12 43 28" stroke={TURBAN_SHADE} strokeWidth={2} fill="none" />
        {/* smile + eyes + moustache */}
        <Path d="M22 33 Q28 37 34 33" stroke={color.ink700} strokeWidth={1.5} fill="none" strokeLinecap="round" />
        <Circle cx={22} cy={28} r={1.5} fill={color.ink700} />
        <Circle cx={34} cy={28} r={1.5} fill={color.ink700} />
        <Path d="M23 32 Q28 34 33 32" stroke={color.ink700} strokeWidth={2} fill="none" strokeLinecap="round" />
        {/* phone in hand */}
        <Rect x={52} y={95} width={22} height={36} rx={3} fill={color.ink700} />
        <Rect x={54} y={97} width={18} height={30} rx={1} fill={color.primary500} />
        <Rect x={56} y={100} width={14} height={3} rx={1} fill={color.white} opacity={0.5} />
        <Rect x={56} y={105} width={10} height={2} fill={color.white} opacity={0.3} />
        <Rect x={56} y={109} width={14} height={2} fill={color.white} opacity={0.3} />
        <Circle cx={63} cy={122} r={2} fill={color.accent500} />
      </G>
    </Svg>
  );
}
