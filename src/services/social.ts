import { supabase } from '@/lib/supabase';

export interface PersonSummary {
  id: string;
  username: string;
  avatarColor: string;
}

export interface FriendRequestSummary {
  id: string;
  person: PersonSummary;
  createdAt: string;
}

export interface RoomInviteSummary {
  id: string;
  roomId: string;
  roomName: string;
  roomEmoji: string;
  inviter: PersonSummary;
  createdAt: string;
}

export interface SocialOverview {
  friends: PersonSummary[];
  incomingRequests: FriendRequestSummary[];
  outgoingRequests: FriendRequestSummary[];
  roomInvites: RoomInviteSummary[];
}

interface FriendshipRow {
  user_low: string;
  user_high: string;
}

interface RequestRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  created_at: string;
}

interface InviteRow {
  id: string;
  room_id: string;
  invited_by: string;
  created_at: string;
}

interface ProfileRow {
  id: string;
  username: string;
  avatar_color: string;
}

interface RoomRow {
  id: string;
  name: string;
  emoji: string;
}

const toPerson = (profile: ProfileRow): PersonSummary => ({
  id: profile.id,
  username: profile.username,
  avatarColor: profile.avatar_color,
});

export async function getSocialOverview(userId: string): Promise<SocialOverview> {
  const [friendshipsResult, incomingResult, outgoingResult, invitesResult] =
    await Promise.all([
      supabase
        .from('friendships')
        .select('user_low, user_high')
        .or(`user_low.eq.${userId},user_high.eq.${userId}`),
      supabase
        .from('friend_requests')
        .select('id, requester_id, addressee_id, created_at')
        .eq('addressee_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabase
        .from('friend_requests')
        .select('id, requester_id, addressee_id, created_at')
        .eq('requester_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabase
        .from('room_invites')
        .select('id, room_id, invited_by, created_at')
        .eq('invited_user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ]);

  for (const result of [friendshipsResult, incomingResult, outgoingResult, invitesResult]) {
    if (result.error) throw result.error;
  }

  const friendships = (friendshipsResult.data ?? []) as unknown as FriendshipRow[];
  const incoming = (incomingResult.data ?? []) as unknown as RequestRow[];
  const outgoing = (outgoingResult.data ?? []) as unknown as RequestRow[];
  const invites = (invitesResult.data ?? []) as unknown as InviteRow[];
  const friendIds = friendships.map((row) =>
    row.user_low === userId ? row.user_high : row.user_low,
  );
  const profileIds = [
    ...friendIds,
    ...incoming.map((row) => row.requester_id),
    ...outgoing.map((row) => row.addressee_id),
    ...invites.map((row) => row.invited_by),
  ];
  const uniqueProfileIds = [...new Set(profileIds)];

  const [profilesResult, roomsResult] = await Promise.all([
    uniqueProfileIds.length
      ? supabase
          .from('profiles')
          .select('id, username, avatar_color')
          .in('id', uniqueProfileIds)
      : Promise.resolve({ data: [], error: null }),
    invites.length
      ? supabase
          .from('rooms')
          .select('id, name, emoji')
          .in('id', [...new Set(invites.map((row) => row.room_id))])
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (roomsResult.error) throw roomsResult.error;

  const profiles = (profilesResult.data ?? []) as unknown as ProfileRow[];
  const rooms = (roomsResult.data ?? []) as unknown as RoomRow[];
  const profileById = new Map(profiles.map((profile) => [profile.id, toPerson(profile)]));
  const roomById = new Map(rooms.map((room) => [room.id, room]));

  const asRequest = (row: RequestRow, personId: string): FriendRequestSummary => ({
    id: row.id,
    person: profileById.get(personId) ?? {
      id: personId,
      username: 'Pessoa',
      avatarColor: '#2563EB',
    },
    createdAt: row.created_at,
  });

  return {
    friends: friendIds
      .map((id) => profileById.get(id))
      .filter((person): person is PersonSummary => Boolean(person))
      .sort((a, b) => a.username.localeCompare(b.username)),
    incomingRequests: incoming.map((row) => asRequest(row, row.requester_id)),
    outgoingRequests: outgoing.map((row) => asRequest(row, row.addressee_id)),
    roomInvites: invites.flatMap((row) => {
      const room = roomById.get(row.room_id);
      if (!room) return [];
      return [
        {
          id: row.id,
          roomId: row.room_id,
          roomName: room.name,
          roomEmoji: room.emoji,
          inviter: profileById.get(row.invited_by) ?? {
            id: row.invited_by,
            username: 'Pessoa',
            avatarColor: '#2563EB',
          },
          createdAt: row.created_at,
        },
      ];
    }),
  };
}

export type FriendRequestEmailResult = 'sent' | 'not_sent' | 'unavailable';
export type InvitationEmailResult = 'sent' | 'not_sent' | 'unavailable';

async function notifyInvitation(
  kind: 'friend_request' | 'room_invite',
  id: string,
): Promise<InvitationEmailResult> {
  const { data, error } = await supabase.functions.invoke('notify-friend-request', {
    body: { kind, id },
  });

  if (error) return 'not_sent';
  return data?.sent === true || data?.reason === 'already_sent'
    ? 'sent'
    : data?.reason === 'recent_attempt'
      ? 'not_sent'
      : 'unavailable';
}

export async function sendFriendRequestByEmail(
  email: string,
): Promise<FriendRequestEmailResult> {
  const { data: requestId, error } = await supabase.rpc('send_friend_request_by_email', {
    p_email: email.trim().toLowerCase(),
  });
  if (error) throw error;

  // Keep the response generic when the email is not registered or a request
  // already exists, so the app does not reveal which addresses have accounts.
  if (typeof requestId !== 'string') return 'unavailable';
  return notifyInvitation('friend_request', requestId);
}

export async function respondFriendRequest(
  requestId: string,
  accept: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('respond_friend_request', {
    p_request_id: requestId,
    p_accept: accept,
  });
  if (error) throw error;
}

export async function cancelFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_friend_request', {
    p_request_id: requestId,
  });
  if (error) throw error;
}

export async function respondRoomInvite(inviteId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('respond_room_invite', {
    p_invite_id: inviteId,
    p_accept: accept,
  });
  if (error) throw error;
}

export async function inviteRoomMemberByEmail(
  roomId: string,
  email: string,
): Promise<InvitationEmailResult> {
  const { data: inviteId, error } = await supabase.rpc('invite_room_member_by_email', {
    p_room_id: roomId,
    p_email: email.trim().toLowerCase(),
  });
  if (error) throw error;
  if (typeof inviteId !== 'string') return 'unavailable';
  return notifyInvitation('room_invite', inviteId);
}

export async function inviteFriendToRoom(
  roomId: string,
  friendId: string,
): Promise<InvitationEmailResult> {
  const { data: inviteId, error } = await supabase.rpc('invite_friend_to_room', {
    p_room_id: roomId,
    p_friend_id: friendId,
  });
  if (error) throw error;
  if (typeof inviteId !== 'string') return 'unavailable';
  return notifyInvitation('room_invite', inviteId);
}
