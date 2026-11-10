import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useStyles } from '@/hooks/useStyles';
import type { Theme } from '@/theme';
import { formatTypingIndicator } from '@/utils/typing';

function Dots() {
  const styles = useStyles(createStyles);
  const reduceMotion = useReduceMotion();
  const [values] = useState(() => [0, 1, 2].map(() => new Animated.Value(0.3)));

  useEffect(() => {
    if (reduceMotion) {
      values.forEach((v) => v.setValue(0.8));
      return;
    }
    const native = Platform.OS !== 'web';
    const loops = values.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(v, { toValue: 1, duration: 350, useNativeDriver: native }),
          Animated.timing(v, { toValue: 0.3, duration: 350, useNativeDriver: native }),
          Animated.delay((2 - i) * 150),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [reduceMotion, values]);

  return (
    <View
      style={styles.dots}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {values.map((v, i) => (
        <Animated.View key={i} style={[styles.dot, { opacity: v }]} />
      ))}
    </View>
  );
}

export function TypingIndicator({ usernames }: { usernames: string[] }) {
  const styles = useStyles(createStyles);
  const text = formatTypingIndicator(usernames);
  if (!text) return null;
  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <Dots />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const createStyles = ({ colors, spacing, typography }: Theme) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingBottom: 4,
    },
    text: { ...typography.caption, color: colors.muted, fontStyle: 'italic' },
    dots: { flexDirection: 'row', gap: 3 },
    dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.muted },
  });
