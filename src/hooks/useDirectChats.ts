import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  getDirectMessages,
  listDirectConversations,
  openDirectConversation,
  sendDirectAudioMessage,
  sendDirectTextMessage,
} from '@/services/directChats';
import type { DirectMessage } from '@/services/directChats';

export function useDirectConversations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['direct-conversations', user?.id],
    queryFn: () => listDirectConversations(user!.id),
    enabled: Boolean(user),
  });
}

/** Atualiza os contadores de não lidas enquanto o app está aberto. */
export function useDirectConversationUpdates(): void {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const queryKey = useMemo(() => ['direct-conversations', userId] as const, [userId]);

  useEffect(() => {
    if (!userId) return undefined;

    const channel = supabase
      .channel(`direct-conversation-updates-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'direct_messages' },
        () => {
          void queryClient.invalidateQueries({ queryKey });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId, queryKey]);
}

export function useDirectMessages(conversationId: string) {
  const queryClient = useQueryClient();
  const queryKey = ['direct-messages', conversationId] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => getDirectMessages(conversationId),
    enabled: Boolean(conversationId),
  });

  useEffect(() => {
    if (!conversationId) return undefined;

    const channel = supabase
      .channel(
        `direct-messages-${conversationId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: ['direct-messages', conversationId],
          });
          void queryClient.invalidateQueries({ queryKey: ['direct-conversations'] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  return query;
}

export function useOpenDirectConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: openDirectConversation,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['direct-conversations'] }),
  });
}

function addMessageToCache(
  queryClient: ReturnType<typeof useQueryClient>,
  conversationId: string,
  message: DirectMessage,
) {
  queryClient.setQueryData<DirectMessage[]>(
    ['direct-messages', conversationId],
    (old) => {
      if (old?.some((item) => item.id === message.id)) return old;
      return [...(old ?? []), message];
    },
  );
  void queryClient.invalidateQueries({ queryKey: ['direct-conversations'] });
}

export function useSendDirectText(conversationId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => {
      if (!user) throw new Error('Faça login para enviar mensagens.');
      return sendDirectTextMessage(conversationId, user.id, body);
    },
    onSuccess: (message) => addMessageToCache(queryClient, conversationId, message),
  });
}

export function useSendDirectAudio(conversationId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ uri, durationMs }: { uri: string; durationMs: number }) => {
      if (!user) throw new Error('Faça login para enviar mensagens.');
      return sendDirectAudioMessage(conversationId, user.id, uri, durationMs);
    },
    onSuccess: (message) => addMessageToCache(queryClient, conversationId, message),
  });
}
