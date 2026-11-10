import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acceptInvite,
  cancelInvite,
  inviteByEmail,
  listInvites,
} from '@/services/invites';

export function useRoomInvites(roomId: string | undefined) {
  return useQuery({
    queryKey: ['invites', roomId],
    queryFn: () => listInvites(roomId!),
    enabled: Boolean(roomId),
  });
}

export function useInviteByEmail(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => inviteByEmail(roomId, email),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invites', roomId] }),
  });
}

export function useCancelInvite(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => cancelInvite(inviteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invites', roomId] }),
  });
}

export function useAcceptInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => acceptInvite(token),
    // A pessoa agora participa de uma sala nova: salas e participações mudam.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rooms'] }),
  });
}
