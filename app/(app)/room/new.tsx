import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';
import { Button } from '@/components/Button';
import { FormInput } from '@/components/FormInput';
import { Screen } from '@/components/Screen';
import { useToast } from '@/components/Toast';
import { useCreateRoom } from '@/hooks/useRooms';
import { useStyles } from '@/hooks/useStyles';
import type { Theme } from '@/theme';
import { friendlyError } from '@/utils/errors';

const schema = z.object({
  name: z.string().trim().min(2, 'Dê um nome à sala').max(60, 'Máximo de 60 caracteres'),
  description: z.string().trim().max(120, 'Máximo de 120 caracteres'),
});
type FormData = z.infer<typeof schema>;

const EMOJIS = ['💬', '🎮', '📚', '🎬', '⚽', '🎵', '💻', '🍕', '✈️', '🐾'];

export default function NewRoomScreen() {
  const router = useRouter();
  const createRoom = useCreateRoom();
  const toast = useToast();
  const styles = useStyles(createStyles);
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const { control, handleSubmit, formState } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  });

  const submit = handleSubmit((values) => {
    createRoom.mutate(
      { name: values.name, description: values.description, emoji },
      {
        onSuccess: (id) => router.replace(`/room/${id}`),
        onError: (e) => toast.show(friendlyError(e), 'error'),
      },
    );
  });

  return (
    <Screen scroll>
      <Text style={styles.label}>Ícone da sala</Text>
      <View style={styles.emojiRow}>
        {EMOJIS.map((e) => (
          <Pressable
            key={e}
            accessibilityRole="radio"
            accessibilityLabel={`Ícone ${e}`}
            accessibilityState={{ checked: e === emoji }}
            onPress={() => setEmoji(e)}
            style={[styles.emojiOption, e === emoji && styles.emojiSelected]}
          >
            <Text style={styles.emojiText}>{e}</Text>
          </Pressable>
        ))}
      </View>

      <FormInput
        control={control}
        name="name"
        label="Nome da sala"
        placeholder="Ex.: Fãs de React Native"
      />
      <FormInput
        control={control}
        name="description"
        label="Descrição (opcional)"
        placeholder="Do que essa sala trata?"
      />

      <Button
        title="Criar sala"
        onPress={submit}
        loading={formState.isSubmitting || createRoom.isPending}
      />
    </Screen>
  );
}

const createStyles = ({ colors, radius, spacing, typography }: Theme) =>
  StyleSheet.create({
    label: { ...typography.label, color: colors.text, marginBottom: spacing.sm },
    emojiRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    emojiOption: {
      width: 48,
      height: 48,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emojiSelected: {
      borderColor: colors.accent,
      borderWidth: 2,
      backgroundColor: colors.primarySoft,
    },
    emojiText: { fontSize: 22 },
  });
