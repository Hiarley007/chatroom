import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { getProfile, updateAvatarColor, updateUsername } from '@/services/profile';

export function useMyProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: Boolean(user),
  });
}

export function useUpdateUsername() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (username: string) => {
      if (!user) throw new Error('Faça login para editar o perfil.');
      return updateUsername(user.id, username);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });
}

export function useUpdateAvatarColor() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (avatarColor: string) => {
      if (!user) throw new Error('Faça login para editar o perfil.');
      return updateAvatarColor(user.id, avatarColor);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });
}
