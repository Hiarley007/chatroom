import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { AccessibilityActionEvent } from 'react-native';
import { useEntrance } from '@/hooks/useEntrance';
import { useStyles } from '@/hooks/useStyles';
import type { Theme } from '@/theme';
import type { Message } from '@/types';
import { formatMessageTime } from '@/utils/messages';
import { Avatar } from './Avatar';

interface MessageBubbleProps {
  message: Message;
  mine: boolean;
  showSender: boolean;
  pending?: boolean;
  animate?: boolean;
  onLongPress?: () => void;
}

export function MessageBubble({
  message,
  mine,
  showSender,
  pending,
  animate = false,
  onLongPress,
}: MessageBubbleProps) {
  const styles = useStyles(createStyles);
  const entrance = useEntrance(animate || !!pending);
  const time = pending ? 'enviando' : formatMessageTime(message.createdAt);
  const canDelete = mine && !!onLongPress;

  return (
    <Animated.View style={[styles.row, mine && styles.rowMine, entrance]}>
      {!mine &&
        (showSender ? (
          <Avatar username={message.username} color={message.avatarColor} size={28} />
        ) : (
          <View style={styles.avatarGap} />
        ))}
      <View
        style={styles.column}
        accessible
        accessibilityLabel={`${mine ? 'Você' : message.username}: ${message.body}. ${time}`}
        accessibilityActions={
          canDelete ? [{ name: 'delete', label: 'Apagar mensagem' }] : undefined
        }
        onAccessibilityAction={(e: AccessibilityActionEvent) => {
          if (e.nativeEvent.actionName === 'delete') onLongPress?.();
        }}
      >
        {!mine && showSender ? (
          <Text style={styles.sender}>{message.username}</Text>
        ) : null}
        <Pressable
          onLongPress={canDelete ? onLongPress : undefined}
          style={[
            styles.bubble,
            mine ? styles.bubbleMine : styles.bubbleTheirs,
            pending && styles.pending,
          ]}
        >
          <Text style={[styles.body, mine && styles.bodyMine]}>{message.body}</Text>
        </Pressable>
        <Text style={[styles.time, mine && styles.timeMine]}>
          {pending ? 'enviando...' : time}
        </Text>
      </View>
    </Animated.View>
  );
}

const createStyles = ({ colors, radius, spacing, typography }: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      marginBottom: 4,
      maxWidth: '85%',
    },
    rowMine: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
    avatarGap: { width: 28 },
    column: { flexShrink: 1 },
    sender: { ...typography.small, color: colors.accent, marginBottom: 2, marginLeft: 4 },
    bubble: {
      borderRadius: radius.lg,
      paddingVertical: 10,
      paddingHorizontal: spacing.md,
    },
    bubbleMine: { backgroundColor: colors.bubbleMine, borderBottomRightRadius: 4 },
    bubbleTheirs: { backgroundColor: colors.bubbleTheirs, borderBottomLeftRadius: 4 },
    pending: { opacity: 0.6 },
    body: { ...typography.body, color: colors.text },
    bodyMine: { color: colors.onPrimary },
    time: { ...typography.small, color: colors.muted, marginTop: 2, marginLeft: 4 },
    timeMine: { textAlign: 'right', marginRight: 4 },
  });
