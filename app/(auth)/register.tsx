import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, StyleSheet, Text } from 'react-native';
import { Button } from '@/components/Button';
import { FormInput } from '@/components/FormInput';
import { Screen } from '@/components/Screen';
import { useStyles } from '@/hooks/useStyles';
import { useAuth } from '@/context/AuthContext';
import { registerSchema } from '@/schemas/auth';
import type { RegisterFormData } from '@/schemas/auth';
import type { Theme } from '@/theme';
import { friendlyError } from '@/utils/errors';

export default function RegisterScreen() {
  const styles = useStyles(createStyles);
  const { signUp } = useAuth();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirm: '' },
  });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const { needsConfirmation } = await signUp(
        values.name,
        values.email,
        values.password,
      );
      if (needsConfirmation) {
        Alert.alert(
          'Confirme seu e-mail',
          'Enviamos um link de confirmação. Verifique sua caixa de entrada e depois entre.',
        );
        router.replace('/login');
      }
      // Sem confirmação exigida: a sessão já existe e o guarda de rota redireciona sozinho.
    } catch (error) {
      setFormError(friendlyError(error));
    }
  });

  return (
    <Screen scroll>
      <Text style={styles.title}>Criar conta</Text>
      <Text style={styles.subtitle}>Leva menos de um minuto.</Text>

      <FormInput
        control={control}
        name="name"
        label="Nome"
        placeholder="Seu nome"
        autoComplete="name"
      />
      <FormInput
        control={control}
        name="email"
        label="E-mail"
        placeholder="voce@email.com"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <FormInput
        control={control}
        name="password"
        label="Senha"
        placeholder="Mínimo de 6 caracteres"
        secureTextEntry
      />
      <FormInput
        control={control}
        name="confirm"
        label="Confirmar senha"
        placeholder="Repita a senha"
        secureTextEntry
      />

      {formError ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={styles.error}
        >
          {formError}
        </Text>
      ) : null}

      <Button title="Criar conta" onPress={submit} loading={formState.isSubmitting} />

      <Link href="/login" style={styles.link}>
        Já tem conta? <Text style={styles.linkStrong}>Entrar</Text>
      </Link>
    </Screen>
  );
}

const createStyles = ({ colors, spacing, typography }: Theme) =>
  StyleSheet.create({
    title: { ...typography.title, color: colors.text, marginTop: spacing.lg },
    subtitle: {
      ...typography.body,
      color: colors.muted,
      marginBottom: spacing.lg,
      marginTop: 4,
    },
    error: {
      ...typography.body,
      color: colors.dangerText,
      marginBottom: spacing.md,
      textAlign: 'center',
    },
    link: {
      ...typography.body,
      marginTop: spacing.lg,
      textAlign: 'center',
      color: colors.muted,
    },
    linkStrong: { ...typography.bodyStrong, color: colors.accent },
  });
