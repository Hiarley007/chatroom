import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { EmptyState, ErrorState, LoadingView } from '@/components/StateViews';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { useToast } from '@/components/Toast';
import { useSocialActions, useSocialOverview } from '@/hooks/useSocial';
import { useOpenDirectConversation } from '@/hooks/useDirectChats';
import { useStyles } from '@/hooks/useStyles';
import { useTheme } from '@/context/ThemeContext';
import type { Theme } from '@/theme';
import type {
  FriendRequestSummary,
  PersonSummary,
  RoomInviteSummary,
} from '@/services/social';
import {
  directChatErrorMessage,
  socialErrorMessage,
} from '@/utils/errors';

type ScreenStyles = ReturnType<typeof createStyles>;

export default function FriendsScreen() {
  const styles = useStyles(createStyles);
  const router = useRouter();
  const { colors } = useTheme();
  const toast = useToast();
  const overview = useSocialOverview();
  const actions = useSocialActions();
  const openConversation = useOpenDirectConversation();
  const [email, setEmail] = useState('');
  const refetchOverview = overview.refetch;

  useFocusEffect(
    useCallback(() => {
      void refetchOverview();
    }, [refetchOverview]),
  );

  if (overview.isLoading) {
    return (
      <Screen>
        <LoadingView />
      </Screen>
    );
  }

  if (overview.isError || !overview.data) {
    return (
      <Screen>
        <ErrorState
          message={socialErrorMessage(
            overview.error,
            'Não foi possível carregar suas amizades agora.',
          )}
          onRetry={() => void overview.refetch()}
        />
      </Screen>
    );
  }

  const { friends, incomingRequests, outgoingRequests, roomInvites } = overview.data;

  async function startConversation(friendId: string) {
    try {
      const conversationId = await openConversation.mutateAsync(friendId);
      router.push(`/chat/${conversationId}`);
    } catch (error) {
      toast.show(directChatErrorMessage(error, 'Não foi possível abrir a conversa.'), 'error');
    }
  }

  async function sendRequest() {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      toast.show('Digite um e-mail válido.', 'error');
      return;
    }
    try {
      const result = await actions.sendFriendRequest.mutateAsync(normalized);
      setEmail('');
      if (result === 'not_sent') {
        toast.show(
          'Não foi possível enviar a notificação por e-mail agora. Tente novamente em alguns minutos.',
          'error',
        );
      } else {
        toast.show(
          'Se o e-mail estiver cadastrado e disponível, a solicitação foi enviada.',
          'success',
        );
      }
    } catch (error) {
      toast.show(
        socialErrorMessage(
          error,
          'Não foi possível enviar a solicitação. Tente novamente.',
        ),
        'error',
      );
    }
  }

  async function answerFriendRequest(request: FriendRequestSummary, accept: boolean) {
    const confirmed = await toast.confirm({
      title: accept ? 'Aceitar amizade?' : 'Recusar solicitação?',
      message: accept
        ? `Você e ${request.person.username} poderão ver a amizade dentro do app.`
        : `A solicitação de ${request.person.username} será encerrada.`,
      confirmLabel: accept ? 'Aceitar' : 'Recusar',
      confirmTone: accept ? 'primary' : 'danger',
    });
    if (!confirmed) return;
    try {
      await actions.respondFriendRequest.mutateAsync({ requestId: request.id, accept });
      toast.show(accept ? 'Amizade aceita.' : 'Solicitação recusada.', 'success');
    } catch (error) {
      toast.show(
        socialErrorMessage(
          error,
          'Não foi possível responder à solicitação. Tente novamente.',
        ),
        'error',
      );
    }
  }

  async function cancelRequest(request: FriendRequestSummary) {
    const confirmed = await toast.confirm({
      title: 'Cancelar solicitação?',
      message: `O pedido para ${request.person.username} será cancelado.`,
      confirmLabel: 'Cancelar pedido',
      confirmTone: 'danger',
    });
    if (!confirmed) return;
    try {
      await actions.cancelFriendRequest.mutateAsync(request.id);
      toast.show('Solicitação cancelada.', 'success');
    } catch (error) {
      toast.show(
        socialErrorMessage(
          error,
          'Não foi possível cancelar a solicitação. Tente novamente.',
        ),
        'error',
      );
    }
  }

  async function answerRoomInvite(invite: RoomInviteSummary, accept: boolean) {
    const confirmed = await toast.confirm({
      title: accept ? 'Aceitar convite para a sala?' : 'Recusar convite?',
      message: accept
        ? `Você passará a participar de ${invite.roomName}.`
        : `O convite para ${invite.roomName} será encerrado.`,
      confirmLabel: accept ? 'Entrar na sala' : 'Recusar convite',
      confirmTone: accept ? 'primary' : 'danger',
    });
    if (!confirmed) return;
    try {
      await actions.respondRoomInvite.mutateAsync({ inviteId: invite.id, accept });
      toast.show(
        accept ? `Você entrou em ${invite.roomName}.` : 'Convite recusado.',
        'success',
      );
    } catch (error) {
      toast.show(
        socialErrorMessage(
          error,
          'Não foi possível responder ao convite. Tente novamente.',
        ),
        'error',
      );
    }
  }

  return (
    <Screen>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={overview.isRefetching}
            onRefresh={() => void overview.refetch()}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            Amizades
          </Text>
          {incomingRequests.length + roomInvites.length > 0 ? (
            <Badge
              label={`${incomingRequests.length + roomInvites.length} pendente${incomingRequests.length + roomInvites.length === 1 ? '' : 's'}`}
              tone="danger"
            />
          ) : null}
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Adicionar amizade</Text>
          <Text style={styles.helper}>
            Encontre alguém pelo e-mail usado no cadastro. A solicitação aparece no app e
            gera um aviso por e-mail.
          </Text>
          <Input
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            placeholder="pessoa@exemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="send"
            onSubmitEditing={() => void sendRequest()}
          />
          <Button
            title="Enviar solicitação"
            onPress={() => void sendRequest()}
            loading={actions.sendFriendRequest.isPending}
            disabled={!email.trim()}
          />
        </View>

        <SectionHeading title="Recebidas" count={incomingRequests.length} />
        {incomingRequests.length ? (
          incomingRequests.map((request) => (
            <PersonCard key={request.id} person={request.person} styles={styles}>
              <View style={styles.actionRow}>
                <Button
                  title="Aceitar"
                  variant="secondary"
                  onPress={() => void answerFriendRequest(request, true)}
                  loading={
                    actions.respondFriendRequest.isPending &&
                    actions.respondFriendRequest.variables?.requestId === request.id &&
                    actions.respondFriendRequest.variables.accept
                  }
                  style={styles.actionButton}
                />
                <Button
                  title="Recusar"
                  variant="danger"
                  onPress={() => void answerFriendRequest(request, false)}
                  loading={
                    actions.respondFriendRequest.isPending &&
                    actions.respondFriendRequest.variables?.requestId === request.id &&
                    !actions.respondFriendRequest.variables.accept
                  }
                  style={styles.actionButton}
                />
              </View>
            </PersonCard>
          ))
        ) : (
          <InlineEmpty text="Nenhuma solicitação recebida." styles={styles} />
        )}

        <SectionHeading title="Convites para salas" count={roomInvites.length} />
        {roomInvites.length ? (
          roomInvites.map((invite) => (
            <View key={invite.id} style={styles.card}>
              <View style={styles.roomEmoji}>
                <Text style={styles.emoji}>{invite.roomEmoji}</Text>
              </View>
              <View style={styles.personInfo}>
                <Text style={styles.personName}>{invite.roomName}</Text>
                <Text style={styles.helper}>Convite de {invite.inviter.username}</Text>
              </View>
              <View style={styles.inviteActions}>
                <Button
                  title="Aceitar"
                  variant="secondary"
                  onPress={() => void answerRoomInvite(invite, true)}
                  loading={
                    actions.respondRoomInvite.isPending &&
                    actions.respondRoomInvite.variables?.inviteId === invite.id &&
                    actions.respondRoomInvite.variables.accept
                  }
                  style={styles.actionButton}
                />
                <Button
                  title="Recusar"
                  variant="ghost"
                  onPress={() => void answerRoomInvite(invite, false)}
                  loading={
                    actions.respondRoomInvite.isPending &&
                    actions.respondRoomInvite.variables?.inviteId === invite.id &&
                    !actions.respondRoomInvite.variables.accept
                  }
                  style={styles.actionButton}
                />
              </View>
            </View>
          ))
        ) : (
          <InlineEmpty text="Nenhum convite de sala pendente." styles={styles} />
        )}

        <SectionHeading title="Enviadas" count={outgoingRequests.length} />
        {outgoingRequests.length ? (
          outgoingRequests.map((request) => (
            <PersonCard key={request.id} person={request.person} styles={styles}>
              <Button
                title="Cancelar pedido"
                variant="ghost"
                onPress={() => void cancelRequest(request)}
                loading={
                  actions.cancelFriendRequest.isPending &&
                  actions.cancelFriendRequest.variables === request.id
                }
              />
            </PersonCard>
          ))
        ) : (
          <InlineEmpty text="Nenhuma solicitação enviada pendente." styles={styles} />
        )}

        <SectionHeading title="Minhas amizades" count={friends.length} />
        {friends.length ? (
          friends.map((person) => (
            <PersonCard key={person.id} person={person} styles={styles}>
              <Button
                title="Conversar"
                variant="secondary"
                onPress={() => void startConversation(person.id)}
                loading={
                  openConversation.isPending && openConversation.variables === person.id
                }
                style={styles.actionButton}
              />
            </PersonCard>
          ))
        ) : (
          <EmptyState
            icon="people-outline"
            title="Sem amizades ainda"
            message="Envie uma solicitação pelo e-mail para começar."
          />
        )}
      </ScrollView>
    </Screen>
  );
}

function SectionHeading({ title, count }: { title: string; count: number }) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.sectionHeading}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      <Badge label={String(count)} tone={count > 0 ? 'accent' : 'neutral'} />
    </View>
  );
}

function PersonCard({
  person,
  children,
  styles,
}: {
  person: PersonSummary;
  children?: ReactNode;
  styles: ScreenStyles;
}) {
  return (
    <View style={styles.card}>
      <Avatar username={person.username} color={person.avatarColor} size={42} />
      <Text style={[styles.personName, styles.flex]} numberOfLines={1}>
        {person.username}
      </Text>
      {children}
    </View>
  );
}

function InlineEmpty({ text, styles }: { text: string; styles: ScreenStyles }) {
  return (
    <View style={styles.inlineEmpty}>
      <Text style={styles.helper}>{text}</Text>
    </View>
  );
}

const createStyles = ({ colors, radius, spacing, typography, shadows }: Theme) =>
  StyleSheet.create({
    content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    title: { ...typography.title, color: colors.text },
    panel: {
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
      ...shadows.card,
    },
    sectionHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    sectionTitle: { ...typography.subheading, color: colors.text },
    helper: { ...typography.caption, color: colors.muted, flexShrink: 1 },
    card: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    personInfo: { flex: 1, minWidth: 120 },
    personName: { ...typography.bodyStrong, color: colors.text },
    flex: { flex: 1 },
    actionRow: { flexDirection: 'row', flex: 1, gap: spacing.xs },
    inviteActions: { flexDirection: 'row', width: '100%', gap: spacing.xs },
    actionButton: { flex: 1 },
    roomEmoji: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 21,
      backgroundColor: colors.primarySoft,
    },
    emoji: { fontSize: 21 },
    inlineEmpty: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceAlt,
    },
  });
