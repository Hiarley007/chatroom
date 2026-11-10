import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useStyles } from '@/hooks/useStyles';
import type { Theme } from '@/theme';
import type { Room } from '@/types';
import { Badge } from './Badge';

interface RoomCardProps {
  room: Room;
  isMember: boolean;
  onPress: () => void;
}

export function RoomCard({ room, isMember, onPress }: RoomCardProps) {
  const { colors } = useTheme();
  const styles = useStyles(createStyles);
  const count = room.memberCount ?? 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${room.name}, ${count} ${count === 1 ? 'participante' : 'participantes'}${isMember ? ', você participa' : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.emojiWrap}>
        <Text style={styles.emoji}>{room.emoji}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {room.name}
        </Text>
        {room.description ? (
          <Text style={styles.description} numberOfLines={1}>
            {room.description}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          <Ionicons name="people" size={13} color={colors.muted} />
          <Text style={styles.meta}>{count}</Text>
          {isMember ? <Badge label="Você participa" /> : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
  );
}

const createStyles = ({ colors, radius, spacing, typography, shadows }: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      ...shadows.card,
    },
    pressed: { opacity: 0.85 },
    emojiWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
    },
    emoji: { fontSize: 26 },
    info: { flex: 1, gap: 2 },
    name: { ...typography.subheading, color: colors.text },
    description: { ...typography.caption, color: colors.muted },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    meta: { ...typography.caption, color: colors.muted },
  });
