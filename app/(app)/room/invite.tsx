import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams } from 'expo-router';
import { useForm } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';
import { Badge } from '@/components/Badge';
import type { BadgeTone } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormInput } from '@/components/FormInput';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import { useCancelInvite, useInviteByEmail, useRoomInvites } from '@/hooks/useInvites';
import { useStyles } from '@/hooks/useStyles';
import { inviteSchema } from '@/schemas/invite';
import type { InviteFormValues } from '@/schemas/invite';
import type { Theme } from '@/theme';
import { inviteErrorMessage } from '@/utils/inviteErrors';
import { formatShortDate, INVITE_STATUS_LABEL, inviteStatus } from '@/utils/invites';
import type { InviteStatus } from '@/utils/invites';

const TONE: Record<InviteStatus, BadgeTone> = {
  pending: 'warning',
  accepted: 'success',
  expired: 'neutral',
};

export default function InviteScreen() {
  const { roomId, roomName } = useLocalSearchParams<{
    roomId: string;
    roomName?: string;
  }>();
  const { user } = useAuth();
  const toast = useToast();
  const styles = useStyles(createStyles);
  const invites = useRoomInvites(roomId);
  const sendInvite = useInviteByEmail(roomId);
  const cancelInvite = useCancelInvite(roomId);
  const { control, handleSubmit, reset, formState } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '' },
  });

  const submit = handleSubmit((values) =>
    sendInvite.mutate(values.email, {
      onSuccess: () => {
        reset();
        toast.show(`Convite enviado para ${values.email}.`, 'success');
      },
      onError: (e) => toast.show(inviteErrorMessage(e), 'error'),
    }),
  );

  return (
    <Screen scroll edges={['left', 'right', 'bottom']}>
      <Text style={styles.intro}>
        Convide alguém por e-mail{roomName ? ` para ${roomName}` : ''}. A pessoa recebe um
        link que vale por 7 dias e só funciona com esse e-mail.
      </Text>

      <FormInput
        control={control}
        name="email"
        label="E-mail de quem será convidado"
        placeholder="amigo@email.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        returnKeyType="send"
        onSubmitEditing={() => void submit()}
      />
      <Button
        title="Enviar convite"
        onPress={submit}
        loading={formState.isSubmitting || sendInvite.isPending}
      />

      <Text accessibilityRole="header" style={styles.sectionTitle}>
        Convites desta sala
      </Text>

      {invites.isLoading ? (
        <Skeleton height={64} radius={16} />
      ) : invites.isError ? (
        <Text style={styles.muted}>Não foi possível carregar os convites.</Text>
      ) : invites.data?.length ? (
        <View style={styles.list}>
          {invites.data.map((invite) => {
            const status = inviteStatus(invite);
            const canCancel = status === 'pending' && invite.invitedBy === user?.id;
            return (
              <Card key={invite.id} style={styles.item}>
                <View style={styles.itemInfo}>
                  <Text style={styles.email} numberOfLines={1}>
                    {invite.email}
                  </Text>
                  <Text style={styles.muted}>
                    Enviado em {formatShortDate(invite.createdAt)}
                  </Text>
                  <Badge tone={TONE[status]} label={INVITE_STATUS_LABEL[status]} />
                </View>
                {canCancel ? (
                  <IconButton
                    icon="close-circle-outline"
                    label={`Cancelar convite para ${invite.email}`}
                    variant="danger"
                    disabled={cancelInvite.isPending}
                    onPress={() =>
                      cancelInvite.mutate(invite.id, {
                        onSuccess: () => toast.show('Convite cancelado.', 'info'),
                        onError: (e) => toast.show(inviteErrorMessage(e), 'error'),
                      })
                    }
                  />
                ) : null}
              </Card>
            );
          })}
        </View>
      ) : (
        <Text style={styles.muted}>Nenhum convite enviado ainda.</Text>
      )}
    </Screen>
  );
}

const createStyles = ({ colors, spacing, typography }: Theme) =>
  StyleSheet.create({
    intro: { ...typography.body, color: colors.muted, marginBottom: spacing.lg },
    sectionTitle: {
      ...typography.label,
      color: colors.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    list: { gap: spacing.sm },
    item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    itemInfo: { flex: 1, gap: 4 },
    email: { ...typography.bodyStrong, color: colors.text },
    muted: { ...typography.caption, color: colors.muted },
  });
