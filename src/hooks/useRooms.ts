import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import type { Room } from '@/types';
import {
  createRoom,
  deleteRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  listMyRoomIds,
  listRoomMembers,
  listRooms,
} from '@/services/rooms';

export const useRooms = () =>
  useQuery({ queryKey: ['rooms', 'list'], queryFn: listRooms });

export const useMyRoomIds = () =>
  useQuery({ queryKey: ['rooms', 'mine'], queryFn: listMyRoomIds });

export function useRoom(id: string | undefined) {
  return useQuery({
    queryKey: ['rooms', 'detail', id],
    queryFn: () => getRoom(id as string),
    enabled: Boolean(id),
  });
}

export function useRoomMembers(id: string | undefined) {
  return useQuery({
    queryKey: ['rooms', 'members', id],
    queryFn: () => listRoomMembers(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateRoom() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      name,
      description,
      emoji,
    }: {
      name: string;
      description: string;
      emoji: string;
    }) => {
      if (!user) throw new Error('Faça login para criar uma sala.');
      return createRoom(name, description, emoji, user.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rooms'] }),
  });
}

export function useJoinRoom() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roomId: string) => {
      if (!user) throw new Error('Faça login para entrar na sala.');
      return joinRoom(roomId, user.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rooms'] }),
  });
}

export function useLeaveRoom() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roomId: string) => {
      if (!user) throw new Error('Faça login para sair da sala.');
      return leaveRoom(roomId, user.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rooms'] }),
  });
}

export function useDeleteRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteRoom,
    onSuccess: async (_result, roomId) => {
      queryClient.setQueryData<Room[]>(['rooms', 'list'], (rooms) =>
        rooms?.filter((room) => room.id !== roomId),
      );
      queryClient.setQueryData<Set<string>>(['rooms', 'mine'], (roomIds) => {
        if (!roomIds) return roomIds;
        const next = new Set(roomIds);
        next.delete(roomId);
        return next;
      });
      queryClient.removeQueries({ queryKey: ['rooms', 'detail', roomId] });
      queryClient.removeQueries({ queryKey: ['rooms', 'members', roomId] });
      queryClient.removeQueries({ queryKey: ['messages', roomId] });
      await queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}
