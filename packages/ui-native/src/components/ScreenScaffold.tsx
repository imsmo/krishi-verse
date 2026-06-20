// packages/ui-native/src/components/ScreenScaffold.tsx · the standard screen wrapper: safe-area padding, the
// cream page background, an optional title header, and a scroll/non-scroll body. Keeps every screen visually
// consistent without each one re-deriving layout. An optional `footer` stays pinned (used for primary CTAs).
import React from 'react';
import { ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, font, space } from '../theme';

export interface ScreenScaffoldProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  testID?: string;
}

export function ScreenScaffold({ title, subtitle, children, footer, scroll = true, contentStyle, testID }: ScreenScaffoldProps) {
  const Body = scroll ? ScrollView : View;
  return (
    <SafeAreaView style={styles.safe} testID={testID}>
      {title ? (
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}
      <Body
        style={styles.body}
        contentContainerStyle={scroll ? [styles.scrollContent, contentStyle] : undefined}
        keyboardShouldPersistTaps={scroll ? 'handled' : undefined}
      >
        {children}
      </Body>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.page },
  header: { paddingHorizontal: space[5], paddingTop: space[4], paddingBottom: space[2] },
  title: { fontFamily: font.display, fontSize: font.size['2xl'], fontWeight: font.weight.bold, color: color.ink800 },
  subtitle: { fontFamily: font.body, fontSize: font.size.md, color: color.ink500, marginTop: space[1] },
  body: { flex: 1 },
  scrollContent: { padding: space[5], gap: space[4] },
  footer: { padding: space[5], borderTopWidth: 1, borderTopColor: color.ink100, backgroundColor: color.card },
});
