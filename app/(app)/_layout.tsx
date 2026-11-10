import { Redirect, Stack, useGlobalSearchParams, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { LoadingView } from '@/components/StateViews';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { savePendingInvite } from '@/lib/pendingInvite';
import { fontFamily } from '@/theme';

export default function AppLayout() {
  const { session, loading } = useAuth();
  const { colors } = useTheme();
  const segments = useSegments();
  const { token } = useGlobalSearchParams<{ token?: string }>();

  // Abriu o link de convite sem estar logado: guarda o token antes de ir ao login.
  const onJoinRoute = (segments as string[])[1] === 'join';
  useEffect(() => {
    if (!loading && !session && onJoinRoute && token) void savePendingInvite(token);
  }, [loading, session, onJoinRoute, token]);

  if (loading) return <LoadingView />;
  if (!session) return <Redirect href="/login" />; // sem sessão: vai para o login

  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.accent,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontFamily: fontFamily.semibold, color: colors.text },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="room/[id]" options={{ title: '' }} />
      <Stack.Screen name="room/new" options={{ title: 'Nova sala' }} />
      <Stack.Screen
        name="room/invite"
        options={{ title: 'Convidar pessoas', presentation: 'modal' }}
      />
      <Stack.Screen
        name="join/[token]"
        options={{ title: 'Convite', headerBackVisible: false }}
      />
    </Stack>
  );
}
