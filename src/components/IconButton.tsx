import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useStyles } from '@/hooks/useStyles';
import { minTouchSize } from '@/theme';
import type { Theme } from '@/theme';

interface IconButtonProps {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string; // lido por leitores de tela: obrigatório, o ícone sozinho não diz nada
  onPress: () => void;
  variant?: 'plain' | 'filled' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  icon,
  label,
  onPress,
  variant = 'plain',
  disabled,
  style,
}: IconButtonProps) {
  const { colors } = useTheme();
  const styles = useStyles(createStyles);
  const color =
    variant === 'filled'
      ? colors.onPrimary
      : variant === 'danger'
        ? colors.dangerText
        : colors.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.base,
        variant === 'filled' && styles.filled,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Ionicons name={icon} size={22} color={color} />
    </Pressable>
  );
}

const createStyles = ({ colors, radius }: Theme) =>
  StyleSheet.create({
    base: {
      width: minTouchSize,
      height: minTouchSize,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filled: { backgroundColor: colors.primary },
    disabled: { opacity: 0.4 },
    pressed: { opacity: 0.7 },
  });
