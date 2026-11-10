import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { LoadingView } from '@/components/StateViews';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useAcceptInvite } from '@/hooks/useInvites';
import { useStyles } from '@/hooks/useStyles';
import { isInviteToken } from '@/lib/pendingInvite';
import type { Theme } from '@/theme';
import { inviteErrorMessage } from '@/utils/inviteErrors';

// Destino do link do e-mail (chatroom://join/<token>): aceita o convite e abre a sala.
export default function JoinScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { signOut } = useAuth();
  const { colors } = useTheme();
  const styles = useStyles(createStyles);
  const accept = useAcceptInvite();
  const started = useRef(false);
  const valid = isInviteToken(token);

  useEffect(() => {
    if (started.current || !valid) return;
    started.current = true; // o convite é de uso único: nunca aceitar duas vezes
    accept.mutate(token, { onSuccess: (roomId) => router.replace(`/room/${roomId}`) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, valid]);

  if (valid && !accept.isError) return <LoadingView />;

  const message = valid
    ? inviteErrorMessage(accept.error)
    : 'Este link de convite está incompleto.';

  return (
    <View style={styles.center}>
      <Ionicons name="mail-unread-outline" size={56} color={colors.muted} />
      <Text accessibilityRole="header" style={styles.title}>
        Não foi possível entrar
      </Text>
      <Text accessibilityLiveRegion="polite" style={styles.text}>
        {message}
      </Text>
      <Button
        title="Ir para as salas"
        onPress={() => router.replace('/')}
        style={styles.button}
      />
      {valid ? (
        <Button
          title="Entrar com outra conta"
          variant="secondary"
          onPress={() => void signOut()}
          accessibilityHint="Encerra a sessão para você entrar com o e-mail que recebeu o convite"
          style={styles.button}
        />
      ) : null}
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
    text: { ...typography.body, color: colors.muted, textAlign: 'center' },
    button: { alignSelf: 'stretch', marginTop: spacing.sm, maxWidth: 420, width: '100%' },
  });
