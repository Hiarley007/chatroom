import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useStyles } from '@/hooks/useStyles';
import type { Theme } from '@/theme';
import type { IconName } from '@/utils/icons';
import { Button } from './Button';

export function LoadingView() {
  const { colors } = useTheme();
  const styles = useStyles(createStyles);
  return (
    <View style={styles.center} accessible accessibilityLabel="Carregando">
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { colors } = useTheme();
  const styles = useStyles(createStyles);
  return (
    <View style={styles.center}>
      <Ionicons name="cloud-offline" size={48} color={colors.muted} />
      <Text accessibilityRole="header" style={styles.title}>
        Algo deu errado
      </Text>
      <Text accessibilityLiveRegion="polite" style={styles.text}>
        {message}
      </Text>
      <Button title="Tentar novamente" onPress={onRetry} style={styles.button} />
    </View>
  );
}

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  message: string;
}

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  message,
}: EmptyStateProps) {
  const { colors } = useTheme();
  const styles = useStyles(createStyles);
  return (
    <View style={styles.center}>
      <Ionicons name={icon} size={48} color={colors.muted} />
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const createStyles = ({ colors, spacing, typography }: Theme) =>
  StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
      gap: spacing.sm,
      backgroundColor: colors.background,
    },
    title: { ...typography.heading, color: colors.text },
    text: { ...typography.body, textAlign: 'center', color: colors.muted },
    button: { marginTop: spacing.sm, alignSelf: 'stretch' },
  });
