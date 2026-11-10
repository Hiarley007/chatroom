import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import type { ColorValue } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import {
  useDirectConversationUpdates,
  useDirectConversations,
} from '@/hooks/useDirectChats';
import { useSocialOverview, useSocialUpdates } from '@/hooks/useSocial';
import { fontFamily } from '@/theme';

interface TabIconProps {
  color: ColorValue;
  size: number;
}

function RoomsTabIcon({ color, size }: TabIconProps) {
  return <Ionicons name="chatbubbles" size={size} color={color as string} />;
}

function ChatsTabIcon({ color, size, unread }: TabIconProps & { unread: number }) {
  return (
    <View>
      <Ionicons name="chatbox-ellipses" size={size} color={color as string} />
      {unread > 0 ? (
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingLabel}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ProfileTabIcon({ color, size }: TabIconProps) {
  return <Ionicons name="person" size={size} color={color as string} />;
}

function FriendsTabIcon({ color, size, pending }: TabIconProps & { pending: number }) {
  return (
    <View>
      <Ionicons name="people" size={size} color={color as string} />
      {pending > 0 ? (
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingLabel}>{pending > 9 ? '9+' : pending}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  useSocialUpdates();
  useDirectConversationUpdates();
  const social = useSocialOverview();
  const conversations = useDirectConversations();
  const unreadConversations =
    conversations.data?.filter((conversation) => conversation.unreadCount > 0).length ?? 0;
  const pending =
    (social.data?.incomingRequests.length ?? 0) + (social.data?.roomInvites.length ?? 0);
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
      <Tabs.Screen name="index" options={{ title: 'Salas', tabBarIcon: RoomsTabIcon }} />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Conversas',
          tabBarIcon: (props) => <ChatsTabIcon {...props} unread={unreadConversations} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Amizades',
          tabBarIcon: (props) => <FriendsTabIcon {...props} pending={pending} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Perfil', tabBarIcon: ProfileTabIcon }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  pendingBadge: {
    position: 'absolute',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    top: -7,
    right: -10,
    backgroundColor: '#EF4444',
    borderColor: '#1F2937',
    borderWidth: 1,
  },
  pendingLabel: { color: '#FFFFFF', fontSize: 9, fontWeight: '700', lineHeight: 11 },
});
