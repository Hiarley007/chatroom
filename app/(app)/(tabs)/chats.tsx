import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Avatar } from '@/components/Avatar';
import { EmptyState, ErrorState, LoadingView } from '@/components/StateViews';
import { Screen } from '@/components/Screen';
import { SearchBar } from '@/components/SearchBar';
import { useTheme } from '@/context/ThemeContext';
import { useDirectConversations } from '@/hooks/useDirectChats';
import { useStyles } from '@/hooks/useStyles';
import { fontFamily } from '@/theme';
import type { Theme } from '@/theme';
import { formatMessageTime } from '@/utils/messages';
import { directChatErrorMessage } from '@/utils/errors';

export default function ChatsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles(createStyles);
  const conversations = useDirectConversations();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    return (conversations.data ?? []).filter((conversation) =>
      conversation.friendName.toLocaleLowerCase('pt-BR').includes(normalized),
    );
  }, [conversations.data, query]);

  if (conversations.isLoading) {
    return (
      <Screen>
        <LoadingView />
      </Screen>
    );
  }

  if (conversations.isError) {
    return (
      <Screen>
        <ErrorState
          message={directChatErrorMessage(
            conversations.error,
            'Não foi possível carregar suas conversas.',
          )}
          onRetry={() => void conversations.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          Conversas
        </Text>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Buscar conversas" />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={conversations.isRefetching}
            onRefresh={() => void conversations.refetch()}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Abrir conversa com ${item.friendName}${item.unreadCount ? `, ${item.unreadCount} mensagens não lidas` : ''}`}
            onPress={() => router.push(`/chat/${item.id}`)}
            style={({ pressed }) => [
              styles.card,
              item.unreadCount > 0 && styles.cardUnread,
              pressed && styles.cardPressed,
            ]}
          >
            <Avatar username={item.friendName} color={item.friendAvatarColor} size={48} />
            <View style={styles.details}>
              <View style={styles.topLine}>
                <Text
                  style={[styles.friendName, item.unreadCount > 0 && styles.friendNameUnread]}
                  numberOfLines={1}
                >
                  {item.friendName}
                </Text>
                <Text style={[styles.time, item.unreadCount > 0 && styles.timeUnread]}>
                  {formatMessageTime(item.updatedAt)}
                </Text>
              </View>
              <Text
                style={[styles.preview, item.unreadCount > 0 && styles.previewUnread]}
                numberOfLines={1}
              >
                {item.lastMessagePreview || 'Toque para começar a conversar'}
              </Text>
            </View>
            <View style={styles.trailing}>
              {item.unreadCount > 0 ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {item.unreadCount > 99 ? '99+' : item.unreadCount}
                  </Text>
                </View>
              ) : null}
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={query ? 'search-outline' : 'chatbox-ellipses-outline'}
            title={query ? 'Nenhuma conversa encontrada' : 'Suas conversas ficam aqui'}
            message={
              query
                ? 'Tente outro nome.'
                : 'Abra Amizades e toque em Conversar ao lado de um amigo para iniciar uma conversa individual.'
            }
          />
        }
      />
    </Screen>
  );
}

const createStyles = ({ colors, spacing, typography, radius }: Theme) =>
  StyleSheet.create({
    header: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.md },
    title: { ...typography.title, color: colors.text },
    listContent: { padding: spacing.md, paddingBottom: spacing.xl, flexGrow: 1 },
    separator: { height: spacing.sm },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    cardUnread: { backgroundColor: colors.primarySoft, borderColor: colors.accent },
    cardPressed: { opacity: 0.78 },
    details: { flex: 1, gap: 4 },
    topLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    friendName: { ...typography.bodyStrong, color: colors.text, flex: 1 },
    friendNameUnread: { color: colors.accent },
    time: { ...typography.small, color: colors.muted },
    timeUnread: { color: colors.accent },
    preview: { ...typography.caption, color: colors.muted },
    previewUnread: { color: colors.text, fontFamily: fontFamily.semibold },
    trailing: { alignItems: 'center', gap: 4 },
    unreadBadge: {
      minWidth: 24,
      height: 24,
      paddingHorizontal: 6,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    unreadBadgeText: { ...typography.small, color: colors.onPrimary, fontFamily: fontFamily.bold },
  });
