import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RoomCard } from '@/components/RoomCard';
import { Screen } from '@/components/Screen';
import { SearchBar } from '@/components/SearchBar';
import { RoomListSkeleton } from '@/components/Skeleton';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { useTheme } from '@/context/ThemeContext';
import { useMyRoomIds, useRooms } from '@/hooks/useRooms';
import { useStyles } from '@/hooks/useStyles';
import type { Theme } from '@/theme';
import { friendlyError } from '@/utils/errors';
import { filterRooms, splitRooms } from '@/utils/rooms';

export default function RoomsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles(createStyles);
  const rooms = useRooms();
  const mine = useMyRoomIds();
  const [query, setQuery] = useState('');

  const sections = useMemo(
    () =>
      splitRooms(filterRooms(rooms.data ?? [], query), mine.data ?? new Set<string>()),
    [rooms.data, mine.data, query],
  );

  const refresh = () => {
    void rooms.refetch();
    void mine.refetch();
  };

  let body;
  if (rooms.isLoading) {
    body = <RoomListSkeleton />;
  } else if (rooms.isError) {
    body = <ErrorState message={friendlyError(rooms.error)} onRetry={refresh} />;
  } else {
    body = (
      <SectionList
        sections={sections}
        keyExtractor={(room) => room.id}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderSectionHeader={({ section }) => (
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {section.title} · {section.data.length}
          </Text>
        )}
        renderItem={({ item }) => (
          <RoomCard
            room={item}
            isMember={mine.data?.has(item.id) ?? false}
            onPress={() => router.push(`/room/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          query ? (
            <EmptyState
              icon="search-outline"
              title="Nenhum resultado"
              message={`Nenhuma sala encontrada para "${query}".`}
            />
          ) : (
            <EmptyState
              icon="chatbubbles-outline"
              title="Nenhuma sala ainda"
              message="Toque no + para criar a primeira sala."
            />
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={rooms.isRefetching}
            onRefresh={refresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      />
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          Salas
        </Text>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Buscar salas" />
      </View>
      <View style={styles.flex}>{body}</View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Criar sala"
        onPress={() => router.push('/room/new')}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Ionicons name="add" size={30} color={colors.onPrimary} />
      </Pressable>
    </Screen>
  );
}

const createStyles = ({ colors, spacing, typography, shadows }: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    header: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.md },
    title: { ...typography.title, color: colors.text },
    listContent: { padding: spacing.md, paddingBottom: 96, flexGrow: 1 },
    separator: { height: spacing.sm },
    sectionTitle: {
      ...typography.label,
      color: colors.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    fab: {
      position: 'absolute',
      right: spacing.lg,
      bottom: spacing.lg,
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      ...shadows.raised,
    },
    fabPressed: { opacity: 0.85 },
  });
