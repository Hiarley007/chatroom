import { Redirect, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { LoadingView } from '@/components/StateViews';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { takePendingInvite } from '@/lib/pendingInvite';

export default function AuthLayout() {
  const { session, loading } = useAuth();
  const { colors } = useTheme();
  if (loading) return <LoadingView />;
  if (session) return <ResumePendingInvite key={session.user.id} />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}

function ResumePendingInvite() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    takePendingInvite().then((pendingToken) => {
      if (!active) return;
      setToken(pendingToken);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!ready) return <LoadingView />;
  return <Redirect href={token ? `/join/${token}` : '/'} />;
}
