import { Redirect, Stack } from 'expo-router';
import { LoadingView } from '@/components/StateViews';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

export default function AuthLayout() {
  const { session, loading } = useAuth();
  const { colors } = useTheme();
  if (loading) return <LoadingView />;
  if (session) return <Redirect href="/" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
