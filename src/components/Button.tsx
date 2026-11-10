import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useStyles } from '@/hooks/useStyles';
import { minTouchSize } from '@/theme';
import type { Theme } from '@/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  accessibilityHint,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const styles = useStyles(createStyles);
  const inactive = disabled || loading;
  const spinnerColor =
    variant === 'secondary'
      ? colors.onPrimarySoft
      : variant === 'ghost'
        ? colors.accent
        : colors.onPrimary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        inactive && styles.inactive,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <Text style={[styles.label, styles[`${variant}Label` as const]]}>{title}</Text>
      )}
    </Pressable>
  );
}

const createStyles = ({ colors, radius, spacing, typography }: Theme) =>
  StyleSheet.create({
    base: {
      minHeight: Math.max(52, minTouchSize),
      borderRadius: radius.pill,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primary: { backgroundColor: colors.primary },
    secondary: { backgroundColor: colors.primarySoft },
    danger: { backgroundColor: colors.danger },
    ghost: { backgroundColor: 'transparent' },
    label: { ...typography.subheading },
    primaryLabel: { color: colors.onPrimary },
    secondaryLabel: { color: colors.onPrimarySoft },
    dangerLabel: { color: colors.onPrimary },
    ghostLabel: { color: colors.accent },
    pressed: { opacity: 0.85 },
    inactive: { opacity: 0.45 },
  });
