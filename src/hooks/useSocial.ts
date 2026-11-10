import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  cancelFriendRequest,
  getSocialOverview,
  inviteFriendToRoom,
  inviteRoomMemberByEmail,
  respondFriendRequest,
  respondRoomInvite,
  sendFriendRequestByEmail,
} from '@/services/social';

export function useSocialOverview() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['social', 'overview', user?.id],
    queryFn: () => getSocialOverview(user!.id),
    enabled: Boolean(user),
  });
}

export function useSocialUpdates() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return undefined;

    const channel = supabase
      .channel(
        `social-updates-${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friend_requests' },
        () => void queryClient.invalidateQueries({ queryKey: ['social', 'overview', userId] }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friendships' },
        () => void queryClient.invalidateQueries({ queryKey: ['social', 'overview', userId] }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_invites' },
        () => void queryClient.invalidateQueries({ queryKey: ['social', 'overview', userId] }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}

function useRefreshSocial() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['social'] });
    void queryClient.invalidateQueries({ queryKey: ['rooms'] });
  };
}

export function useSocialActions() {
  const refresh = useRefreshSocial();
  return {
    sendFriendRequest: useMutation({
      mutationFn: sendFriendRequestByEmail,
      onSuccess: refresh,
    }),
    respondFriendRequest: useMutation({
      mutationFn: ({ requestId, accept }: { requestId: string; accept: boolean }) =>
        respondFriendRequest(requestId, accept),
      onSuccess: refresh,
    }),
    cancelFriendRequest: useMutation({
      mutationFn: cancelFriendRequest,
      onSuccess: refresh,
    }),
    respondRoomInvite: useMutation({
      mutationFn: ({ inviteId, accept }: { inviteId: string; accept: boolean }) =>
        respondRoomInvite(inviteId, accept),
      onSuccess: refresh,
    }),
  };
}

export function useRoomInviteActions(roomId: string) {
  const refresh = useRefreshSocial();
  return {
    inviteByEmail: useMutation({
      mutationFn: (email: string) => inviteRoomMemberByEmail(roomId, email),
      onSuccess: refresh,
    }),
    inviteFriend: useMutation({
      mutationFn: (friendId: string) => inviteFriendToRoom(roomId, friendId),
      onSuccess: refresh,
    }),
  };
}
