import { StyleSheet, Text, View } from 'react-native';
import { useStyles } from '@/hooks/useStyles';
import { fontFamily } from '@/theme';
import type { Theme } from '@/theme';
import { initials } from '@/utils/avatar';

interface AvatarProps {
  username: string;
  color: string;
  size?: number;
  online?: boolean;
}

export function Avatar({ username, color, size = 36, online = false }: AvatarProps) {
  const styles = useStyles(createStyles);
  const dot = Math.max(8, Math.round(size * 0.28));
  return (
    <View accessible accessibilityLabel={`Avatar de ${username}`}>
      <View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        ]}
      >
        <Text style={[styles.text, { fontSize: size * 0.4 }]}>{initials(username)}</Text>
      </View>
      {online ? (
        <View
          style={[
            styles.dot,
            { width: dot, height: dot, borderRadius: dot / 2, right: -1, bottom: -1 },
          ]}
        />
      ) : null}
    </View>
  );
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    circle: { alignItems: 'center', justifyContent: 'center' },
    // As cores de avatar são escolhidas por pessoa (não pelo tema): o texto é sempre branco.
    text: { color: '#FFFFFF', fontFamily: fontFamily.extrabold },
    dot: {
      position: 'absolute',
      backgroundColor: colors.online,
      borderWidth: 2,
      borderColor: colors.background,
    },
  });
