import { StyleSheet, Text, View } from 'react-native';
import { useStyles } from '@/hooks/useStyles';
import type { Theme } from '@/theme';

export function DaySeparator({ label }: { label: string }) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.row} accessibilityRole="header">
      <Text style={styles.pill}>{label}</Text>
    </View>
  );
}

const createStyles = ({ colors, radius, spacing, typography }: Theme) =>
  StyleSheet.create({
    row: { alignItems: 'center', marginVertical: spacing.md },
    pill: {
      ...typography.small,
      color: colors.muted,
      backgroundColor: colors.surfaceAlt,
      paddingHorizontal: spacing.md,
      paddingVertical: 4,
      borderRadius: radius.pill,
      overflow: 'hidden',
    },
  });
