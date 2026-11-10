import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { EmptyState, ErrorState, LoadingView } from '@/components/StateViews';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import { useDeleteRoom, useLeaveRoom, useMyRoomIds, useRoom, useRoomMembers } from '@/hooks/useRooms';
import { useRoomInviteActions, useSocialOverview } from '@/hooks/useSocial';
import { useStyles } from '@/hooks/useStyles';
import type { Theme } from '@/theme';
import { socialErrorMessage } from '@/utils/errors';

export default function RoomSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const styles = useStyles(createStyles);
  const toast = useToast();
  const room = useRoom(id);
  const memberIds = useMyRoomIds();
  const members = useRoomMembers(id);
  const social = useSocialOverview();
  const roomInvites = useRoomInviteActions(id);
  const deleteRoom = useDeleteRoom();
  const leaveRoom = useLeaveRoom();
  const [inviteEmail, setInviteEmail] = useState('');

  const isMember = memberIds.data?.has(id) ?? false;
  const isAdmin =
    room.data?.createdBy === user?.id ||
    (members.data ?? []).some((member) => member.userId === user?.id && member.role === 'admin');

  if (room.isLoading) {
    return (
      <Screen>
        <LoadingView />
      </Screen>
    );
  }

  if (room.isError || !room.data) {
    return (
      <Screen>
        <ErrorState
          message="Não foi possível carregar as configurações da sala."
          onRetry={() => void room.refetch()}
        />
      </Screen>
    );
  }

  const currentRoom = room.data;

  async function inviteByEmail() {
    const email = inviteEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.show('Digite um e-mail válido.', 'error');
      return;
    }
    try {
      const result = await roomInvites.inviteByEmail.mutateAsync(email);
      setInviteEmail('');
      if (result === 'not_sent') {
        toast.show(
          'O convite ficou registrado no app, mas o email não foi enviado. Tente novamente em alguns minutos.',
          'error',
        );
      } else {
        toast.show('Se o email estiver cadastrado e puder entrar, o convite foi registrado.', 'success');
      }
    } catch (error) {
      toast.show(
        socialErrorMessage(error, 'Não foi possível enviar o convite. Tente novamente.'),
        'error',
      );
    }
  }

  async function inviteFriend(friendId: string, username: string) {
    try {
      const result = await roomInvites.inviteFriend.mutateAsync(friendId);
      if (result === 'not_sent') {
        toast.show(
          `O convite para ${username} ficou registrado no app, mas o email não foi enviado. Tente novamente em alguns minutos.`,
          'error',
        );
      } else {
        toast.show(`Se ${username} puder entrar, o convite foi registrado.`, 'success');
      }
    } catch (error) {
      toast.show(
        socialErrorMessage(error, 'Não foi possível enviar o convite. Tente novamente.'),
        'error',
      );
    }
  }

  async function confirmDeleteRoom() {
    const confirmed = await toast.confirm({
      title: 'Apagar sala?',
      message: `A sala "${currentRoom.name}" e todas as mensagens serão apagadas. Esta ação não pode ser desfeita.`,
      confirmLabel: 'Apagar sala',
      confirmTone: 'danger',
    });
    if (!confirmed) return;
    try {
      await deleteRoom.mutateAsync(id);
      toast.show('Sala apagada.', 'success');
      router.replace('/');
    } catch {
      toast.show('Não foi possível apagar a sala. Verifique se você é administrador.', 'error');
    }
  }

  async function confirmLeaveRoom() {
    const confirmed = await toast.confirm({
      title: 'Sair da sala?',
      message: `Deseja sair de "${currentRoom.name}"?`,
      confirmLabel: 'Sair da sala',
      confirmTone: 'danger',
    });
    if (!confirmed) return;
    try {
      await leaveRoom.mutateAsync(id);
      toast.show('Você saiu da sala.', 'success');
      router.replace('/');
    } catch {
      toast.show('Não foi possível sair da sala. Tente novamente.', 'error');
    }
  }

  const participantCount = members.data?.length ?? currentRoom.memberCount ?? 0;

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: 'Configurações' }} />
      <View style={styles.header}>
        <Text style={styles.emoji}>{currentRoom.emoji}</Text>
        <View style={styles.roomInfo}>
          <Text accessibilityRole="header" style={styles.title}>{currentRoom.name}</Text>
          {currentRoom.description ? (
            <Text style={styles.description}>{currentRoom.description}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.countCard}>
        <Text style={styles.count}>{participantCount}</Text>
        <View style={styles.roomInfo}>
          <Text style={styles.countTitle}>Participantes</Text>
          <Text style={styles.description}>Pessoas que fazem parte desta sala</Text>
        </View>
      </View>

      <Text accessibilityRole="header" style={styles.sectionTitle}>Integrantes</Text>
      {members.isLoading ? (
        <Text style={styles.description}>Carregando integrantes…</Text>
      ) : members.isError ? (
        <Text style={styles.errorText}>
          {socialErrorMessage(
            members.error,
            'Não foi possível carregar a lista de integrantes.',
          )}
        </Text>
      ) : members.data?.length ? (
        members.data.map((member) => (
          <View key={member.userId} style={styles.memberRow}>
            <Avatar username={member.username} color={member.avatarColor} size={42} />
            <View style={styles.memberInfo}>
              <Text style={styles.memberName} numberOfLines={1}>{member.username}</Text>
              {member.role === 'admin' ? <Text style={styles.adminLabel}>Admin</Text> : null}
            </View>
          </View>
        ))
      ) : (
        <EmptyState
          icon="people-outline"
          title="Lista indisponível"
          message={isMember ? 'Os integrantes ainda não puderam ser carregados.' : 'Entre na sala para ver seus integrantes.'}
        />
      )}

      {isAdmin ? (
        <View style={styles.adminPanel}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Convidar pessoas</Text>
          <Text style={styles.description}>
            O convite aparece na aba Amizades da pessoa. Nenhum e-mail externo será enviado.
          </Text>
          <Input
            label="E-mail cadastrado"
            value={inviteEmail}
            onChangeText={setInviteEmail}
            placeholder="pessoa@exemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="send"
            onSubmitEditing={() => void inviteByEmail()}
          />
          <Button
            title="Enviar convite"
            onPress={() => void inviteByEmail()}
            loading={roomInvites.inviteByEmail.isPending}
            disabled={!inviteEmail.trim()}
          />
          <Text style={styles.sectionSubheading}>Ou convide uma amizade</Text>
          {social.isError ? (
            <Text style={styles.errorText}>
              {socialErrorMessage(social.error, 'Não foi possível carregar suas amizades.')}
            </Text>
          ) : social.data?.friends.length ? (
            social.data.friends.map((friend) => {
              const alreadyMember = members.data?.some((member) => member.userId === friend.id);
              return (
                <View key={friend.id} style={styles.friendRow}>
                  <Avatar username={friend.username} color={friend.avatarColor} size={34} />
                  <Text style={styles.memberName} numberOfLines={1}>{friend.username}</Text>
                  <Button
                    title={alreadyMember ? 'Na sala' : 'Convidar'}
                    variant="secondary"
                    disabled={alreadyMember}
                    loading={
                      roomInvites.inviteFriend.isPending &&
                      roomInvites.inviteFriend.variables === friend.id
                    }
                    onPress={() => void inviteFriend(friend.id, friend.username)}
                    style={styles.friendButton}
                  />
                </View>
              );
            })
          ) : (
            <Text style={styles.description}>Nenhuma amizade disponível para convidar.</Text>
          )}
        </View>
      ) : null}

      {isAdmin ? (
        <Button
          title="Apagar sala"
          variant="danger"
          onPress={() => void confirmDeleteRoom()}
          loading={deleteRoom.isPending}
          style={styles.bottomAction}
        />
      ) : isMember ? (
        <Button
          title="Sair da sala"
          variant="ghost"
          onPress={() => void confirmLeaveRoom()}
          loading={leaveRoom.isPending}
          style={styles.bottomAction}
        />
      ) : null}
    </Screen>
  );
}

const createStyles = ({ colors, radius, spacing, typography, shadows }: Theme) =>
  StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
    emoji: { fontSize: 42 },
    roomInfo: { flex: 1, gap: 3 },
    title: { ...typography.title, color: colors.text },
    description: { ...typography.caption, color: colors.muted },
    countCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.card,
    },
    count: { ...typography.title, color: colors.accent, minWidth: 42, textAlign: 'center' },
    countTitle: { ...typography.bodyStrong, color: colors.text },
    sectionTitle: { ...typography.subheading, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginBottom: spacing.xs,
    },
    memberInfo: { flex: 1, gap: 1 },
    memberName: { ...typography.bodyStrong, color: colors.text, flex: 1 },
    adminLabel: { ...typography.small, color: colors.accent },
    errorText: { ...typography.caption, color: colors.dangerText, marginBottom: spacing.sm },
    adminPanel: {
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    sectionSubheading: { ...typography.label, color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs },
    friendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
    friendButton: { minWidth: 108 },
    bottomAction: { marginTop: spacing.xl, marginBottom: spacing.xl },
  });
