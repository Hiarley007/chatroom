import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

export interface DirectConversationSummary {
  id: string;
  friendId: string;
  friendName: string;
  friendAvatarColor: string;
  friendLastSeenAt: string | null;
  updatedAt: string;
  lastMessagePreview: string;
  lastMessageType: 'text' | 'audio' | null;
  unreadCount: number;
  hidden: boolean;
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  type: 'text' | 'audio';
  body: string;
  audioPath: string | null;
  audioDurationMs: number | null;
  readAt: string | null;
  createdAt: string;
  username: string;
  avatarColor: string;
}

interface ConversationRow {
  id: string;
  user_low: string;
  user_high: string;
  updated_at: string;
  last_message_preview: string;
  last_message_type: 'text' | 'audio' | null;
}

interface ProfileRow {
  id: string;
  username: string;
  avatar_color: string;
  last_seen_at: string | null;
}

interface DirectMessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_type: 'text' | 'audio';
  body: string;
  audio_path: string | null;
  audio_duration_ms: number | null;
  read_at: string | null;
  created_at: string;
  sender: { username: string; avatar_color: string } | null;
}

interface DirectConversationClearRow {
  conversation_id: string;
  cleared_at: string;
}

const MESSAGE_SELECT =
  'id, conversation_id, sender_id, message_type, body, audio_path, audio_duration_ms, read_at, created_at, sender:profiles!direct_messages_sender_id_fkey(username, avatar_color)';

function toDirectMessage(row: DirectMessageRow): DirectMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    type: row.message_type,
    body: row.body,
    audioPath: row.audio_path,
    audioDurationMs: row.audio_duration_ms,
    readAt: row.read_at,
    createdAt: row.created_at,
    username: row.sender?.username ?? 'Pessoa',
    avatarColor: row.sender?.avatar_color ?? '#2563EB',
  };
}

export async function listDirectConversations(
  userId: string,
): Promise<DirectConversationSummary[]> {
  const { data: rows, error } = await supabase
    .from('direct_conversations')
    .select(
      'id, user_low, user_high, updated_at, last_message_preview, last_message_type',
    )
    .or(`user_low.eq.${userId},user_high.eq.${userId}`)
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) throw error;

  const conversations = (rows ?? []) as ConversationRow[];
  if (!conversations.length) return [];

  const [clearsResult, unreadResult] = await Promise.all([
    supabase
      .from('direct_conversation_clears')
      .select('conversation_id, cleared_at')
      .eq('user_id', userId)
      .in('conversation_id', conversations.map((conversation) => conversation.id)),
    supabase
      .from('direct_messages')
      .select('conversation_id, created_at')
      .in('conversation_id', conversations.map((conversation) => conversation.id))
      .neq('sender_id', userId)
      .is('read_at', null),
  ]);
  if (clearsResult.error) throw clearsResult.error;
  if (unreadResult.error) throw unreadResult.error;

  const clearedAtByConversation = new Map(
    ((clearsResult.data ?? []) as DirectConversationClearRow[]).map((row) => [
      row.conversation_id,
      row.cleared_at,
    ]),
  );

  const unreadByConversation = new Map<string, number>();
  for (const row of unreadResult.data ?? []) {
    const clearedAt = clearedAtByConversation.get(row.conversation_id);
    if (clearedAt && row.created_at <= clearedAt) continue;
    unreadByConversation.set(
      row.conversation_id,
      (unreadByConversation.get(row.conversation_id) ?? 0) + 1,
    );
  }

  const friendIds = conversations.map((conversation) =>
    conversation.user_low === userId ? conversation.user_high : conversation.user_low,
  );
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, avatar_color, last_seen_at')
    .in('id', friendIds);
  if (profilesError) throw profilesError;

  const profileById = new Map(
    ((profiles ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
  );

  return conversations.map((conversation, index) => {
    const friendId = friendIds[index];
    const profile = profileById.get(friendId);
    const clearedAt = clearedAtByConversation.get(conversation.id);
    const hidden = Boolean(clearedAt && conversation.updated_at <= clearedAt);
    return {
      id: conversation.id,
      friendId,
      friendName: profile?.username ?? 'Pessoa',
      friendAvatarColor: profile?.avatar_color ?? '#2563EB',
      friendLastSeenAt: profile?.last_seen_at ?? null,
      updatedAt: conversation.updated_at,
      lastMessagePreview: hidden ? '' : conversation.last_message_preview,
      lastMessageType: hidden ? null : conversation.last_message_type,
      unreadCount: hidden ? 0 : unreadByConversation.get(conversation.id) ?? 0,
      hidden,
    };
  });
}

export async function getDirectMessages(
  conversationId: string,
  limit = 100,
): Promise<DirectMessage[]> {
  const { data: clear, error: clearError } = await supabase
    .from('direct_conversation_clears')
    .select('cleared_at')
    .eq('conversation_id', conversationId)
    .maybeSingle();
  if (clearError) throw clearError;

  let query = supabase
    .from('direct_messages')
    .select(MESSAGE_SELECT)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (clear?.cleared_at) query = query.gt('created_at', clear.cleared_at);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as DirectMessageRow[]).map(toDirectMessage).reverse();
}

export async function openDirectConversation(friendId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_direct_conversation', {
    p_friend_id: friendId,
  });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Não foi possível abrir esta conversa.');
  return data;
}

export async function clearDirectConversation(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('clear_direct_conversation', {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
}

export async function removeDirectFriendship(friendId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_direct_friendship', {
    p_friend_id: friendId,
  });
  if (error) throw error;
}

export async function blockDirectContact(blockedId: string): Promise<void> {
  const { error } = await supabase.rpc('block_direct_contact', {
    p_blocked_id: blockedId,
  });
  if (error) throw error;
}

export async function sendDirectTextMessage(
  conversationId: string,
  senderId: string,
  body: string,
): Promise<DirectMessage> {
  const normalized = body.trim();
  if (!normalized || normalized.length > 2000) {
    throw new Error('A mensagem precisa ter entre 1 e 2.000 caracteres.');
  }

  const { data, error } = await supabase
    .from('direct_messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      message_type: 'text',
      body: normalized,
    })
    .select(MESSAGE_SELECT)
    .single();
  if (error) throw error;
  return toDirectMessage(data as unknown as DirectMessageRow);
}

export async function sendDirectAudioMessage(
  conversationId: string,
  senderId: string,
  uri: string,
  durationMs: number,
): Promise<DirectMessage> {
  if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 600_000) {
    throw new Error('O áudio deve ter até 10 minutos.');
  }

  let file: Blob | File;
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('Não foi possível ler o áudio gravado.');
    file = await response.blob();
  } else {
    const localFile = new File(uri);
    if (!localFile.exists) throw new Error('Não foi possível ler o áudio gravado.');
    file = localFile;
  }
  if (file.size === 0) throw new Error('O áudio gravado está vazio.');
  if (file.size > 10 * 1024 * 1024)
    throw new Error('O áudio ultrapassa o limite de 10 MB.');

  const isWebm =
    Platform.OS === 'web' || uri.toLowerCase().split('?')[0].endsWith('.webm');
  const extension = isWebm ? 'webm' : 'm4a';
  const contentType = isWebm ? 'audio/webm' : 'audio/mp4';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  const audioPath = `${conversationId}/${senderId}/${fileName}`;
  const storage = supabase.storage.from('direct-audio');

  const { error: uploadError } = await storage.upload(audioPath, file, {
    contentType,
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('direct_messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      message_type: 'audio',
      body: '',
      audio_path: audioPath,
      audio_duration_ms: Math.round(durationMs),
    })
    .select(MESSAGE_SELECT)
    .single();

  if (error) {
    await storage.remove([audioPath]);
    throw error;
  }

  return toDirectMessage(data as unknown as DirectMessageRow);
}

export async function getDirectAudioUrl(audioPath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('direct-audio')
    .createSignedUrl(audioPath, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function markDirectMessagesRead(
  conversationId: string,
  readerId: string,
): Promise<void> {
  const { error } = await supabase
    .from('direct_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', readerId)
    .is('read_at', null);
  if (error) throw error;
}
