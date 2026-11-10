import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface RoomInvite {
  id: string;
  roomId: string;
  email: string;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
}

interface InviteRow {
  id: string;
  room_id: string;
  email: string;
  invited_by: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

const toInvite = (row: InviteRow): RoomInvite => ({
  id: row.id,
  roomId: row.room_id,
  email: row.email,
  invitedBy: row.invited_by,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
  acceptedAt: row.accepted_at,
});

// Nota: o app nunca seleciona a coluna `token`. Ela só existe para o link do e-mail.
export async function listInvites(roomId: string): Promise<RoomInvite[]> {
  const { data, error } = await supabase
    .from('room_invites')
    .select('id, room_id, email, invited_by, created_at, expires_at, accepted_at')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as InviteRow[]).map(toInvite);
}

// Quem grava o convite e envia o e-mail é a Edge Function `send-invite`.
export async function inviteByEmail(roomId: string, email: string): Promise<void> {
  const { error } = await supabase.functions.invoke('send-invite', {
    body: { roomId, email },
  });
  if (!error) return;

  if (error instanceof FunctionsHttpError || error instanceof FunctionsRelayError) {
    const response = error.context as Response | undefined;
    const status = response?.status;
    const body = await response?.clone().json().catch(() => null);
    const detail =
      typeof body?.error === 'string'
        ? body.error
        : typeof body?.message === 'string'
          ? body.message
          : null;

    if (detail && /function (not found|does not exist)/i.test(detail)) {
      throw new Error(
        'O serviço de convites não está publicado no Supabase. Publique a função send-invite.',
      );
    }
    if (detail) throw new Error(detail);
    if (status === 404) {
      throw new Error(
        'O serviço de convites não está publicado no Supabase. Publique a função send-invite.',
      );
    }
    if (status === 401 || status === 403) {
      throw new Error('Sua sessão não foi aceita pelo Supabase. Entre novamente e tente de novo.');
    }
    throw new Error('O Supabase não conseguiu processar o convite. Tente novamente mais tarde.');
  }

  if (error instanceof FunctionsFetchError) {
    throw new Error(
      'Não foi possível acessar send-invite. Confirme se a função está publicada no projeto Supabase; se estiver, verifique a conexão do aparelho.',
    );
  }

  throw new Error('Não foi possível enviar o convite. Tente novamente mais tarde.');
}

export async function cancelInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.from('room_invites').delete().eq('id', inviteId);
  if (error) throw error;
}

// Devolve o id da sala em que a pessoa acabou de entrar.
export async function acceptInvite(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_invite', { p_token: token });
  if (error) throw new Error(error.message);
  return data as string;
}
