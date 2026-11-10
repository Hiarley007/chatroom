import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/context/ThemeContext';
import type { ThemeMode } from '@/context/ThemeContext';
import {
  useMyProfile,
  useUpdateAvatarColor,
  useUpdateUsername,
} from '@/hooks/useMyProfile';
import { useStyles } from '@/hooks/useStyles';
import type { Theme } from '@/theme';
import { PALETTE } from '@/utils/avatar';
import { friendlyError } from '@/utils/errors';

const MODE_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
];

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { data: profile } = useMyProfile();
  const updateUsername = useUpdateUsername();
  const updateAvatarColor = useUpdateAvatarColor();
  const { mode, setMode } = useThemeMode();
  const toast = useToast();
  const styles = useStyles(createStyles);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  function startEditing() {
    setName(profile?.username ?? '');
    setEditing(true);
  }

  function save() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.show('Use pelo menos 2 caracteres no nome.', 'error');
      return;
    }
    updateUsername.mutate(trimmed, {
      onSuccess: () => {
        setEditing(false);
        toast.show('Nome atualizado.', 'success');
      },
      onError: (e) => toast.show(friendlyError(e), 'error'),
    });
  }

  function chooseColor(color: string) {
    if (color === profile?.avatarColor) return;
    updateAvatarColor.mutate(color, {
      onError: (e) => toast.show(friendlyError(e), 'error'),
    });
  }

  function confirmSignOut() {
    Alert.alert('Sair', 'Deseja encerrar a sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => signOut().catch((e) => toast.show(friendlyError(e), 'error')),
      },
    ]);
  }

  return (
    <Screen scroll>
      <Text accessibilityRole="header" style={styles.title}>
        Perfil
      </Text>

      <Card style={styles.card}>
        {profile ? (
          <Avatar username={profile.username} color={profile.avatarColor} size={72} />
        ) : null}
        {editing ? (
          <View style={styles.editRow}>
            <Input
              label="Nome exibido no chat"
              value={name}
              onChangeText={setName}
              autoFocus
            />
            <View style={styles.editButtons}>
              <Button
                title="Cancelar"
                variant="ghost"
                onPress={() => setEditing(false)}
                style={styles.editButton}
              />
              <Button
                title="Salvar"
                onPress={save}
                loading={updateUsername.isPending}
                style={styles.editButton}
              />
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.name}>{profile?.username}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <Button title="Editar nome" variant="ghost" onPress={startEditing} />
          </>
        )}
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Cor do avatar</Text>
        <View style={styles.swatches}>
          {PALETTE.map((color) => {
            const selected = color === profile?.avatarColor;
            return (
              <Pressable
                key={color}
                accessibilityRole="radio"
                accessibilityLabel={`Cor ${color}`}
                accessibilityState={{ checked: selected }}
                onPress={() => chooseColor(color)}
                style={[
                  styles.swatch,
                  { backgroundColor: color },
                  selected && styles.swatchSelected,
                ]}
              >
                {selected ? (
                  <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Aparência</Text>
        <SegmentedControl
          options={MODE_OPTIONS}
          value={mode}
          onChange={setMode}
          accessibilityLabel="Aparência do aplicativo"
        />
      </Card>

      <Button
        title="Sair da conta"
        variant="danger"
        onPress={confirmSignOut}
        style={styles.signOut}
      />
    </Screen>
  );
}

const createStyles = ({ colors, spacing, typography }: Theme) =>
  StyleSheet.create({
    title: { ...typography.title, color: colors.text, marginBottom: spacing.md },
    card: { alignItems: 'center', gap: spacing.sm },
    name: { ...typography.heading, color: colors.text },
    email: { ...typography.body, color: colors.muted },
    editRow: { alignSelf: 'stretch' },
    editButtons: { flexDirection: 'row', gap: spacing.sm },
    editButton: { flex: 1 },
    section: { marginTop: spacing.md, gap: spacing.sm },
    sectionTitle: {
      ...typography.label,
      color: colors.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    swatch: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: 'transparent',
    },
    swatchSelected: { borderColor: colors.text },
    signOut: { marginTop: spacing.lg },
  });
