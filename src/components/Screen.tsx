import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Edge } from 'react-native-safe-area-context';
import { useStyles } from '@/hooks/useStyles';
import { maxContentWidth } from '@/theme';
import type { Theme } from '@/theme';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
}

// Em telas grandes (tablet e web) o conteúdo fica centralizado, com largura máxima.
export function Screen({
  children,
  scroll = false,
  edges = ['top', 'left', 'right'],
}: ScreenProps) {
  const styles = useStyles(createStyles);
  return (
    <SafeAreaView style={styles.flex} edges={edges}>
      {scroll ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.inner}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const createStyles = ({ colors, spacing }: Theme) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    inner: { flex: 1, width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' },
    scrollContent: {
      padding: spacing.md,
      flexGrow: 1,
      width: '100%',
      maxWidth: maxContentWidth,
      alignSelf: 'center',
    },
  });
