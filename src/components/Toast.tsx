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
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEntrance } from '@/hooks/useEntrance';
import { useStyles } from '@/hooks/useStyles';
import { maxContentWidth } from '@/theme';
import type { Theme } from '@/theme';

export type ToastTone = 'error' | 'success' | 'info';

interface ToastContextValue {
  show: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

// Aviso rápido que NÃO bloqueia a tela (some sozinho em 3,5 s). Use no lugar de
// Alert para erros e confirmações simples; mantenha Alert só para perguntas
// ("Tem certeza?").
export const useToast = () => useContext(ToastContext);

interface ToastData {
  id: number;
  message: string;
  tone: ToastTone;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback((message: string, tone: ToastTone = 'info') => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), message, tone });
    AccessibilityInfo.announceForAccessibility(message);
    timer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <ToastView key={toast.id} toast={toast} onDismiss={() => setToast(null)} />
      ) : null}
    </ToastContext.Provider>
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
  });
