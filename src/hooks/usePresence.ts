import { AppState } from 'react-native';
import { createContext, createElement, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useMyProfile } from './useMyProfile';

export interface OnlineUser {
  userId: string;
  username: string;
}

const GLOBAL_PRESENCE_TOPIC = 'chatroom-global-presence';

interface GlobalPresenceSnapshot {
  userIds: Set<string>;
  ready: boolean;
}

const GlobalPresenceContext = createContext<GlobalPresenceSnapshot | null>(null);

/** Mantém um único canal de presença ativo durante toda a sessão autenticada. */
export function GlobalPresenceProvider({
  userId,
  children,
}: {
  userId: string | undefined;
  children: ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<GlobalPresenceSnapshot>({
    userIds: new Set(),
    ready: false,
  });

  useEffect(() => {
    if (!userId) return undefined;

    const channel = supabase.channel(GLOBAL_PRESENCE_TOPIC, {
      config: { presence: { key: userId } },
    });
    let subscribed = false;

    const refreshOnlineUsers = () => {
      setSnapshot({
        userIds: new Set(Object.keys(channel.presenceState())),
        ready: true,
      });
    };

    const touchLastSeen = () => {
      void (async () => {
        try {
          await supabase.rpc('touch_user_presence');
        } catch {
          // A falha de last seen não deve interromper a presença em tempo real.
        }
      })();
    };

    channel
      .on('presence', { event: 'sync' }, refreshOnlineUsers)
      .on('presence', { event: 'join' }, refreshOnlineUsers)
      .on('presence', { event: 'leave' }, refreshOnlineUsers)
      .subscribe((status) => {
        subscribed = status === 'SUBSCRIBED';
        if (!subscribed) {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setSnapshot((current) => ({ ...current, ready: true }));
          }
          return;
        }

        touchLastSeen();
        if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') {
          void channel.track({ userId, onlineAt: new Date().toISOString() });
        }
      });

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        touchLastSeen();
        if (subscribed) {
          void channel.track({ userId, onlineAt: new Date().toISOString() });
        }
      } else {
        touchLastSeen();
        if (subscribed) void channel.untrack();
      }
    });

    const heartbeat = setInterval(() => {
      if (AppState.currentState === 'active') touchLastSeen();
    }, 60_000);

    return () => {
      clearInterval(heartbeat);
      appStateSubscription.remove();
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return createElement(GlobalPresenceContext.Provider, { value: snapshot }, children);
}

/** Lê a presença do amigo do canal global compartilhado pela sessão. */
export function useDirectContactPresence(friendId: string | undefined): boolean | null {
  const presence = useContext(GlobalPresenceContext);
  if (!friendId || !presence?.ready) return null;
  return presence.userIds.has(friendId);
}

// "Quem está online agora, nesta sala" — sem nenhuma tabela no banco. O
// Presence do Supabase Realtime mantém essa lista em memória, compartilhada
// entre todo mundo que está com o canal aberto, e a atualiza sozinho quando
// alguém entra ou sai (inclusive por queda de conexão).
export function useRoomPresence(roomId: string | undefined): OnlineUser[] {
  const { user } = useAuth();
  const { data: profile } = useMyProfile();
  const [online, setOnline] = useState<OnlineUser[]>([]);

  useEffect(() => {
    if (!roomId || !user) return undefined;

    const channel = supabase.channel(`presence-${roomId}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ username: string }>();
        const list = Object.entries(state).map(([userId, metas]) => ({
          userId,
          username: metas[0]?.username ?? 'Alguém',
        }));
        setOnline(list);
      })
      .subscribe(async (status) => {
        // Só "avisa presença" depois de confirmado que o canal está aberto.
        if (status === 'SUBSCRIBED') {
          await channel.track({ username: profile?.username ?? 'Você' });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, user, profile?.username]);

  return online;
}
