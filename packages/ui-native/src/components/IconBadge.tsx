// packages/ui-native/src/components/IconBadge.tsx · a rounded-square icon tile with a diagonal two-colour
// gradient fill and a white line-icon centred on top — the design's role/quick-action tile. Built on
// react-native-svg (gradient rect) + the Icon primitive, so screens never inline raw SVG or a gradient lib.
// Colours come from theme tokens at the call-site (e.g. color.primary500 → color.primary600); decorative by
// default (a11y-hidden) since the adjacent label carries the meaning.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Icon, type IconName } from './Icon';
import { radius as tokenRadius, color } from '../theme';

export interface IconBadgeProps {
  name: IconName;
  /** Gradient start colour (top-left). */
  from: string;
  /** Gradient end colour (bottom-right). */
  to: string;
  /** Tile edge length in px (default 56, matching the design). */
  size?: number;
  /** Icon glyph size in px (default ~57% of the tile). */
  iconSize?: number;
  /** Corner radius (defaults to the design's md token). */
  cornerRadius?: number;
  /** Icon stroke colour (defaults to white, as the design uses). */
  iconColor?: string;
}

let _gid = 0;

export function IconBadge({ name, from, to, size = 56, iconSize, cornerRadius = tokenRadius.md, iconColor = color.white }: IconBadgeProps) {
  // Stable, unique gradient id per instance (two badges must not share a <Defs> id).
  const gradId = React.useMemo(() => `iconbadge-grad-${(_gid += 1)}`, []);
  const glyph = iconSize ?? Math.round(size * 0.57);
  return (
    <View style={[styles.wrap, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={size} height={size} rx={cornerRadius} ry={cornerRadius} fill={`url(#${gradId})`} />
      </Svg>
      <Icon name={name} size={glyph} color={iconColor} weight={2} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
