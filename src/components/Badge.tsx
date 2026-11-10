import { StyleSheet, Text, View } from 'react-native';
import { useStyles } from '@/hooks/useStyles';
import type { Theme } from '@/theme';

export type BadgeTone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral';

export function Badge({ label, tone = 'accent' }: { label: string; tone?: BadgeTone }) {
  const styles = useStyles(createStyles);
  return (
    <View style={[styles.base, styles[tone]]}>
      <Text style={[styles.text, styles[`${tone}Text` as const]]}>{label}</Text>
    </View>
  );
}

const createStyles = ({ colors, radius, typography }: Theme) =>
  StyleSheet.create({
    base: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
    },
    text: { ...typography.small },
    accent: { backgroundColor: colors.primarySoft },
    accentText: { color: colors.onPrimarySoft },
    success: { backgroundColor: colors.successSoft },
    successText: { color: colors.success },
    warning: { backgroundColor: colors.warningSoft },
    warningText: { color: colors.warning },
    danger: { backgroundColor: colors.dangerSoft },
    dangerText: { color: colors.dangerText },
    neutral: { backgroundColor: colors.surfaceAlt },
    neutralText: { color: colors.muted },
  });
