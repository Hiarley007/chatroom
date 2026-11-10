import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { fontFamily } from '@/theme';

interface TabIconProps {
  color: ColorValue;
  size: number;
}

function RoomsTabIcon({ color, size }: TabIconProps) {
  return <Ionicons name="chatbubbles" size={size} color={color as string} />;
}

function ProfileTabIcon({ color, size }: TabIconProps) {
  return <Ionicons name="person" size={size} color={color as string} />;
}

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fontFamily.medium },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Salas', tabBarIcon: RoomsTabIcon }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Perfil', tabBarIcon: ProfileTabIcon }}
      />
    </Tabs>
  );
}
