import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import { useStyles } from '@/hooks/useStyles';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import type { Theme } from '@/theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

// Bloco cinza que pulsa enquanto o conteúdo real carrega (no lugar do spinner).
export function Skeleton({
  width = '100%',
  height = 16,
  radius = 8,
  style,
}: SkeletonProps) {
  const styles = useStyles(createStyles);
  const reduceMotion = useReduceMotion();
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    const native = Platform.OS !== 'web';
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: native,
        }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, opacity]);

  return (
    <Animated.View
      style={[styles.block, { width, height, borderRadius: radius, opacity }, style]}
    />
  );
}

export function RoomListSkeleton({ count = 4 }: { count?: number }) {
  const styles = useStyles(createStyles);
  return (
    <View accessible accessibilityLabel="Carregando salas" style={styles.list}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.card}>
          <Skeleton width={48} height={48} radius={24} />
          <View style={styles.lines}>
            <Skeleton width="55%" height={16} />
            <Skeleton width="85%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function MessageListSkeleton() {
  const styles = useStyles(createStyles);
  const rows: { mine: boolean; w: DimensionValue }[] = [
    { mine: false, w: '60%' },
    { mine: false, w: '40%' },
    { mine: true, w: '50%' },
    { mine: false, w: '70%' },
    { mine: true, w: '35%' },
  ];
  return (
    <View accessible accessibilityLabel="Carregando mensagens" style={styles.list}>
      {rows.map((r, i) => (
        <View key={i} style={[styles.bubbleRow, r.mine && styles.bubbleRowMine]}>
          <Skeleton width={r.w} height={40} radius={18} />
        </View>
      ))}
    </View>
  );
}

const createStyles = ({ colors, radius, spacing }: Theme) =>
  StyleSheet.create({
    block: { backgroundColor: colors.border },
    list: { padding: spacing.md, gap: spacing.sm },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    lines: { flex: 1, gap: spacing.sm },
    bubbleRow: { flexDirection: 'row' },
    bubbleRowMine: { justifyContent: 'flex-end' },
  });
