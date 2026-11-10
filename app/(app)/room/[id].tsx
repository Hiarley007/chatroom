import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AvatarStack } from '@/components/AvatarStack';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { DaySeparator } from '@/components/DaySeparator';
import { IconButton } from '@/components/IconButton';
import { MessageBubble } from '@/components/MessageBubble';
import { MessageListSkeleton } from '@/components/Skeleton';
import { EmptyState, ErrorState, LoadingView } from '@/components/StateViews';
import { useToast } from '@/components/Toast';
import { TypingIndicator } from '@/components/TypingIndicator';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useDeleteMessage, useMessages, useSendMessage } from '@/hooks/useMessages';
import { useRoomPresence } from '@/hooks/usePresence';
import {
  useJoinRoom,
  useMyRoomIds,
  useRoom,
  useRoomMembers,
} from '@/hooks/useRooms';
import { useStyles } from '@/hooks/useStyles';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { maxContentWidth } from '@/theme';
import type { Theme } from '@/theme';
import { colorForId } from '@/utils/avatar';
import { buildChatItems } from '@/utils/chatItems';
import type { ChatItem } from '@/utils/chatItems';
import { friendlyError } from '@/utils/errors';
import type { Message } from '@/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardVerticalOffset = Platform.OS === 'ios' ? insets.top + 44 : 0;
  const styles = useStyles(createStyles);
  const toast = useToast();
  const room = useRoom(id);
  const { data: myRoomIds } = useMyRoomIds();
  const isMember = myRoomIds?.has(id) ?? false;
  const messages = useMessages(id);
  const sendMessage = useSendMessage(id);
  const deleteMessage = useDeleteMessage(id);
  const joinRoom = useJoinRoom();
  const online = useRoomPresence(isMember ? id : undefined);
  const { typingUsernames, notifyTyping } = useTypingIndicator(isMember ? id : undefined);
  const { data: members } = useRoomMembers(id);
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<ChatItem>>(null);

  // Separadores de dia + agrupamento por autor (utils/chatItems.ts).
  const items = useMemo(() => buildChatItems(messages.data ?? []), [messages.data]);

  // Quem está online, com a cor de avatar de cada pessoa.
  const onlineUsers = useMemo(() => {
    const colorById = new Map((members ?? []).map((m) => [m.userId, m.avatarColor]));
    return online.map((o) => ({
      id: o.userId,
      username: o.username,
      color: colorById.get(o.userId) ?? colorForId(o.userId),
    }));
  }, [online, members]);

  const isAdmin =
    room.data?.createdBy === user?.id ||
    (members ?? []).some((member) => member.userId === user?.id && member.role === 'admin');

  useEffect(() => {
    if (messages.data?.length)
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, [messages.data?.length]);

  if (room.isLoading) return <LoadingView />;
  if (room.isError || !room.data) {
    return (
      <ErrorState
        message={friendlyError(room.error)}
        onRetry={() => void room.refetch()}
      />
    );
  }

  function handleSend() {
    const body = text.trim();
    if (!body) return;
    setText('');
    sendMessage.mutate(body, { onError: (e) => toast.show(friendlyError(e), 'error') });
  }

  async function confirmDelete(message: Message) {
    const isOthersMessage = message.userId !== user?.id;
    const confirmed = await toast.confirm({
      title: isOthersMessage ? 'Apagar mensagem de outra pessoa?' : 'Apagar sua mensagem?',
      message: isOthersMessage
        ? `A mensagem de ${message.username} será removida para todos. Esta ação não pode ser desfeita.`
        : 'Esta ação não pode ser desfeita.',
      confirmLabel: 'Apagar',
      confirmTone: 'danger',
    });
    if (!confirmed) return;

    try {
      await deleteMessage.mutateAsync(message.id);
      toast.show('Mensagem apagada.', 'success');
    } catch {
      toast.show('Não foi possível apagar a mensagem. Tente novamente.', 'error');
    }
  }

  if (!isMember) {
    const count = room.data.memberCount ?? 0;
    return (
      <View style={styles.joinScreen}>
        <Stack.Screen options={{ title: room.data.name }} />
        <Text style={styles.joinEmoji}>{room.data.emoji}</Text>
        <Text accessibilityRole="header" style={styles.joinTitle}>
          {room.data.name}
        </Text>
        {room.data.description ? (
          <Text style={styles.joinDescription}>{room.data.description}</Text>
        ) : null}
        <Badge
          tone="neutral"
          label={`${count} ${count === 1 ? 'participante' : 'participantes'}`}
        />
        <Button
          title="Entrar na sala"
          loading={joinRoom.isPending}
          onPress={() =>
            joinRoom.mutate(id, { onError: (e) => toast.show(friendlyError(e), 'error') })
          }
          style={styles.joinButton}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <Stack.Screen
        options={{
          title: room.data.name,
          headerRight: () => (
            <View style={styles.headerActions}>
              <IconButton
                icon="settings-outline"
                label="Configurações da sala"
                onPress={() => router.push(`/room/${id}/settings`)}
              />
            </View>
          ),
        }}
      />
      <View style={styles.inner}>
        <View style={styles.onlineBar}>
          {onlineUsers.length > 0 ? (
            <AvatarStack users={onlineUsers} />
          ) : (
            <View style={styles.onlineDot} />
          )}
          <Text style={styles.onlineText}>
            {online.length} online{members?.length ? ` · ${members.length} na sala` : ''}
          </Text>
        </View>

        {messages.isLoading ? (
          <MessageListSkeleton />
        ) : (
          <FlatList
            ref={listRef}
            data={items}
            keyExtractor={(item) => item.key}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) =>
              item.type === 'day' ? (
                <DaySeparator label={item.label} />
              ) : (
                <MessageBubble
                  message={item.message}
                  mine={item.message.userId === user?.id}
                  canDelete={isAdmin}
                  showSender={item.showSender}
                  pending={item.message.id.startsWith('temp-')}
                  animate={item.message.animate}
                  onLongPress={() => void confirmDelete(item.message)}
                />
              )
            }
            ListEmptyComponent={
              <EmptyState
                icon="chatbubble-ellipses-outline"
                title="Nenhuma mensagem ainda"
                message="Diga olá e comece a conversa!"
              />
            }
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        <TypingIndicator usernames={typingUsernames} />

        <View style={styles.composer}>
          <TextInput
            accessibilityLabel="Escrever mensagem"
            value={text}
            onChangeText={(t) => {
              setText(t);
              if (t.length > 0) notifyTyping();
            }}
            placeholder="Escreva uma mensagem"
            placeholderTextColor={colors.muted}
            selectionColor={colors.accent}
            style={styles.input}
            multiline
          />
          <IconButton
            icon="send"
            label="Enviar mensagem"
            variant="filled"
            onPress={handleSend}
            disabled={!text.trim()}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = ({ colors, radius, spacing, typography }: Theme) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    inner: { flex: 1, width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' },
    headerActions: { flexDirection: 'row', alignItems: 'center' },
    onlineBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
    },
    onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.online },
    onlineText: { ...typography.caption, color: colors.muted },
    list: { padding: spacing.md, gap: 2, flexGrow: 1 },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      padding: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    input: {
      ...typography.body,
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      minWidth: 0,
      paddingHorizontal: spacing.md,
      paddingTop: 12,
      paddingBottom: 12,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceAlt,
      color: colors.text,
    },
    joinScreen: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
      gap: spacing.sm,
      backgroundColor: colors.background,
    },
    joinEmoji: { fontSize: 64 },
    joinTitle: { ...typography.title, color: colors.text, textAlign: 'center' },
    joinDescription: { ...typography.body, color: colors.muted, textAlign: 'center' },
    joinButton: {
      alignSelf: 'stretch',
      marginTop: spacing.md,
      maxWidth: 420,
      width: '100%',
    },
  });
