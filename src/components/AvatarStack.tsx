import { StyleSheet, Text, View } from 'react-native';
import { useStyles } from '@/hooks/useStyles';
import type { Theme } from '@/theme';
import { Avatar } from './Avatar';

export interface StackUser {
  id: string;
  username: string;
  color: string;
}

// Avatares sobrepostos ("quem está online"), com "+N" para o excedente.
export function AvatarStack({
  users,
  max = 4,
  size = 28,
}: {
  users: StackUser[];
  max?: number;
  size?: number;
}) {
  const styles = useStyles(createStyles);
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${users.length} pessoas online`}
    >
      {shown.map((u, i) => (
        <View
          key={u.id}
          style={[
            styles.ring,
            { marginLeft: i === 0 ? 0 : -size * 0.3, borderRadius: size },
          ]}
        >
          <Avatar username={u.username} color={u.color} size={size} />
        </View>
      ))}
      {extra > 0 ? (
        <View
          style={[
            styles.more,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: -size * 0.3,
            },
          ]}
        >
          <Text style={styles.moreText}>+{extra}</Text>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = ({ colors, typography }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center' },
    ring: { borderWidth: 2, borderColor: colors.surface },
    more: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlt,
      borderWidth: 2,
      borderColor: colors.surface,
    },
    moreText: { ...typography.small, color: colors.muted },
  });
