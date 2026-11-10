import { Redirect, Stack } from 'expo-router';
import { LoadingView } from '@/components/StateViews';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { fontFamily } from '@/theme';
import { GlobalPresenceProvider } from '@/hooks/usePresence';

export default function AppLayout() {
  const { session, user, loading } = useAuth();
  const { colors } = useTheme();
  if (loading) return <LoadingView />;
  if (!session) return <Redirect href="/login" />; // sem sessão: vai para o login

  return (
    <GlobalPresenceProvider userId={user?.id}>
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
        <Stack.Screen name="chat/[id]" options={{ title: 'Conversa' }} />
        <Stack.Screen name="room/[id]" options={{ title: '' }} />
        <Stack.Screen name="room/[id]/settings" options={{ title: 'Configurações' }} />
        <Stack.Screen name="room/new" options={{ title: 'Nova sala' }} />
      </Stack>
    </GlobalPresenceProvider>
  );
}
