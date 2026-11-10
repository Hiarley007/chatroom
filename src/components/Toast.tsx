import { Ionicons } from '@expo/vector-icons';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { useEntrance } from '@/hooks/useEntrance';
import { useStyles } from '@/hooks/useStyles';
import { maxContentWidth } from '@/theme';
import type { Theme } from '@/theme';

export type ToastTone = 'error' | 'success' | 'info';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmTone?: 'danger' | 'primary';
}

interface ToastContextValue {
  show: (message: string, tone?: ToastTone) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextValue>({
  show: () => {},
  confirm: async () => false,
});

// Avisos e confirmações ficam na interface do app, sem Alert do sistema ou navegador.
export const useToast = () => useContext(ToastContext);

interface ToastData {
  id: number;
  message: string;
  tone: ToastTone;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmOptions | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingConfirmation = useRef<((confirmed: boolean) => void) | null>(null);

  const show = useCallback((message: string, tone: ToastTone = 'info') => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), message, tone });
    AccessibilityInfo.announceForAccessibility(message);
    timer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    pendingConfirmation.current?.(false);
    return new Promise<boolean>((resolve) => {
      pendingConfirmation.current = resolve;
      setConfirmation(options);
    });
  }, []);

  const answerConfirmation = useCallback((confirmed: boolean) => {
    const resolve = pendingConfirmation.current;
    pendingConfirmation.current = null;
    setConfirmation(null);
    resolve?.(confirmed);
  }, []);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      pendingConfirmation.current?.(false);
      pendingConfirmation.current = null;
    },
    [],
  );

  const value = useMemo(() => ({ show, confirm }), [show, confirm]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <ToastView key={toast.id} toast={toast} onDismiss={() => setToast(null)} />
      ) : null}
      {confirmation ? (
        <ConfirmView
          confirmation={confirmation}
          onCancel={() => answerConfirmation(false)}
          onConfirm={() => answerConfirmation(true)}
        />
      ) : null}
    </ToastContext.Provider>
  );
}

function ConfirmView({
  confirmation,
  onCancel,
  onConfirm,
}: {
  confirmation: ConfirmOptions;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const styles = useStyles(createStyles);

  return (
    <View style={styles.confirmationBackdrop}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={confirmation.cancelLabel ?? 'Cancelar'}
        accessibilityHint="Fecha a confirmação sem realizar a ação."
        onPress={onCancel}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.confirmationCard}>
        <Text accessibilityRole="header" style={styles.confirmationTitle}>
          {confirmation.title}
        </Text>
        <Text style={styles.confirmationMessage}>{confirmation.message}</Text>
        <View style={styles.confirmationActions}>
          <Button
            title={confirmation.cancelLabel ?? 'Cancelar'}
            variant="ghost"
            onPress={onCancel}
            style={styles.confirmationAction}
          />
          <Button
            title={confirmation.confirmLabel ?? 'Confirmar'}
            variant={confirmation.confirmTone ?? 'primary'}
            onPress={onConfirm}
            style={styles.confirmationAction}
          />
        </View>
      </View>
    </View>
  );
}

function ToastView({ toast, onDismiss }: { toast: ToastData; onDismiss: () => void }) {
  const insets = useSafeAreaInsets();
  const styles = useStyles(createStyles);
  const entrance = useEntrance(true);
  const icon =
    toast.tone === 'error'
      ? 'alert-circle'
      : toast.tone === 'success'
        ? 'checkmark-circle'
        : 'information-circle';
  const fg = styles[`${toast.tone}Text` as const].color as string;

  return (
    <ToastContainer entrance={entrance} top={insets.top + 8}>
      <Pressable
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={toast.message}
        onPress={onDismiss}
        style={[styles.toast, styles[toast.tone]]}
      >
        <Ionicons name={icon} size={20} color={fg} />
        <Text style={[styles.text, styles[`${toast.tone}Text` as const]]}>
          {toast.message}
        </Text>
      </Pressable>
    </ToastContainer>
  );
}

// Contêiner animado, posicionado no topo e sem bloquear toques fora do aviso.
function ToastContainer({
  entrance,
  top,
  children,
}: {
  entrance: ReturnType<typeof useEntrance>;
  top: number;
  children: ReactNode;
}) {
  return (
    <Animated.View pointerEvents="box-none" style={[wrapper.base, { top }, entrance]}>
      {children}
    </Animated.View>
  );
}

const wrapper = StyleSheet.create({
  base: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 1000 },
});

const createStyles = ({ colors, radius, spacing, typography, shadows }: Theme) =>
  StyleSheet.create({
    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      width: '100%',
      maxWidth: maxContentWidth,
      paddingVertical: spacing.sm + 4,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      ...shadows.raised,
    },
    text: { ...typography.bodyStrong, flex: 1 },
    error: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerText },
    errorText: { color: colors.dangerText },
    success: { backgroundColor: colors.successSoft, borderColor: colors.success },
    successText: { color: colors.success },
    info: { backgroundColor: colors.surface, borderColor: colors.border },
    infoText: { color: colors.text },
    confirmationBackdrop: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: 2000,
      elevation: 12,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.md,
      backgroundColor: colors.overlay,
    },
    confirmationCard: {
      width: '100%',
      maxWidth: 420,
      padding: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      ...shadows.raised,
    },
    confirmationTitle: { ...typography.heading, color: colors.text },
    confirmationMessage: {
      ...typography.body,
      color: colors.muted,
      marginTop: spacing.sm,
    },
    confirmationActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    confirmationAction: { flex: 1 },
  });
