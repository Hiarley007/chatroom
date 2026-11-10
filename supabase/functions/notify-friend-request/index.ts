import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import nodemailer from 'npm:nodemailer@7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing function secret: ${name}`);
  return value;
}

function getSupabaseSecretKey(): string {
  const legacyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacyKey) return legacyKey;

  const namedKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (namedKeys) {
    try {
      const keys = JSON.parse(namedKeys) as Record<string, string>;
      if (keys.default) return keys.default;
    } catch {
      // Continue to the explicit function secret below.
    }
  }

  return requiredEnv('CHATROOM_SUPABASE_SECRET_KEY');
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !/[\r\n<>]/.test(value);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') return jsonResponse({ error: 'Método não permitido.' }, 405);

  try {
    const authorization = request.headers.get('Authorization');
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) return jsonResponse({ error: 'Sessão necessária.' }, 401);

    const { kind, id } = (await request.json()) as {
      kind?: unknown;
      id?: unknown;
    };
    if (
      (kind !== 'friend_request' && kind !== 'room_invite') ||
      typeof id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      )
    ) {
      return jsonResponse({ error: 'Convite inválido.' }, 400);
    }

    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const admin = createClient(supabaseUrl, getSupabaseSecretKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authResult, error: authError } = await admin.auth.getUser(accessToken);
    if (authError || !authResult.user) {
      return jsonResponse({ error: 'Sessão inválida.' }, 401);
    }

    const cooldownBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    let recipientUserId: string;
    let room: { name: string; emoji: string } | null = null;
    if (kind === 'friend_request') {
      const { data: friendRequest, error: requestError } = await admin
        .from('friend_requests')
        .select('id, requester_id, status')
        .eq('id', id)
        .maybeSingle();
      if (requestError) throw requestError;
      if (
        !friendRequest ||
        friendRequest.requester_id !== authResult.user.id ||
        friendRequest.status !== 'pending'
      ) {
        return jsonResponse({ error: 'Solicitação não encontrada.' }, 404);
      }

      const { data: claimedRequest, error: claimError } = await admin
        .from('friend_requests')
        .update({ email_notification_attempted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('requester_id', authResult.user.id)
        .eq('status', 'pending')
        .is('email_notification_sent_at', null)
        .or(
          `email_notification_attempted_at.is.null,email_notification_attempted_at.lt.${cooldownBefore}`,
        )
        .select('id, addressee_id')
        .maybeSingle();
      if (claimError) throw claimError;
      if (!claimedRequest) {
        const { data: currentRequest, error: currentError } = await admin
          .from('friend_requests')
          .select('email_notification_sent_at')
          .eq('id', id)
          .maybeSingle();
        if (currentError) throw currentError;
        return jsonResponse({
          sent: false,
          reason: currentRequest?.email_notification_sent_at ? 'already_sent' : 'recent_attempt',
        });
      }
      recipientUserId = claimedRequest.addressee_id;
    } else {
      const { data: roomInvite, error: inviteError } = await admin
        .from('room_invites')
        .select('id, invited_by, invited_user_id, room_id, status')
        .eq('id', id)
        .maybeSingle();
      if (inviteError) throw inviteError;
      if (
        !roomInvite ||
        roomInvite.invited_by !== authResult.user.id ||
        roomInvite.status !== 'pending'
      ) {
        return jsonResponse({ error: 'Convite não encontrado.' }, 404);
      }

      const { data: claimedInvite, error: claimError } = await admin
        .from('room_invites')
        .update({ email_notification_attempted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('invited_by', authResult.user.id)
        .eq('status', 'pending')
        .is('email_notification_sent_at', null)
        .or(
          `email_notification_attempted_at.is.null,email_notification_attempted_at.lt.${cooldownBefore}`,
        )
        .select('id, invited_user_id, room_id')
        .maybeSingle();
      if (claimError) throw claimError;
      if (!claimedInvite) {
        const { data: currentInvite, error: currentError } = await admin
          .from('room_invites')
          .select('email_notification_sent_at')
          .eq('id', id)
          .maybeSingle();
        if (currentError) throw currentError;
        return jsonResponse({
          sent: false,
          reason: currentInvite?.email_notification_sent_at ? 'already_sent' : 'recent_attempt',
        });
      }
      recipientUserId = claimedInvite.invited_user_id;

      const { data: roomResult, error: roomError } = await admin
        .from('rooms')
        .select('name, emoji')
        .eq('id', claimedInvite.room_id)
        .maybeSingle();
      if (roomError) throw roomError;
      if (!roomResult) throw new Error('The invited room could not be found.');
      room = roomResult;
    }

    const { data: recipientResult, error: recipientError } = await admin.auth.admin.getUserById(
      recipientUserId,
    );
    if (recipientError) throw recipientError;
    const recipientEmail = recipientResult.user.email?.trim();
    if (!recipientEmail || !validEmail(recipientEmail)) {
      throw new Error('The recipient does not have a valid email address.');
    }

    const { data: requesterProfile, error: profileError } = await admin
      .from('profiles')
      .select('username')
      .eq('id', authResult.user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    const smtpHost = requiredEnv('SMTP_HOST');
    const smtpPort = Number(requiredEnv('SMTP_PORT'));
    const smtpUser = requiredEnv('SMTP_USER');
    const smtpPass = requiredEnv('SMTP_PASS');
    const smtpFrom = requiredEnv('SMTP_FROM');
    if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535 || !validEmail(smtpFrom)) {
      throw new Error('Invalid SMTP settings.');
    }

    const requesterName = escapeHtml(requesterProfile?.username?.trim() || 'Alguém');
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      requireTLS: smtpPort !== 465,
      auth: { user: smtpUser, pass: smtpPass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });

    const roomName = room?.name.trim() || '';
    const safeRoomSubject = roomName.replace(/[\r\n]+/g, ' ').slice(0, 100);
    const subject = room
      ? `Convite para entrar em ${safeRoomSubject} no ChatRoom`
      : 'Nova solicitação de amizade no ChatRoom';
    const text = room
      ? `${room.emoji} ${roomName}: ${requesterProfile?.username?.trim() || 'Alguém'} convidou você para entrar nesta sala no ChatRoom. Abra o app e acesse Amizades para responder ao convite.`
      : `${requesterProfile?.username?.trim() || 'Alguém'} enviou uma solicitação de amizade. Abra o ChatRoom e acesse Amizades para responder.`;
    const html = room
      ? `<p>Olá!</p><p><strong>${requesterName}</strong> convidou você para entrar na sala <strong>${escapeHtml(room.emoji)} ${escapeHtml(roomName)}</strong> no ChatRoom.</p><p>Abra o app e acesse <strong>Amizades</strong> para aceitar ou recusar.</p>`
      : `<p>Olá!</p><p><strong>${requesterName}</strong> enviou uma solicitação de amizade no ChatRoom.</p><p>Abra o app e acesse <strong>Amizades</strong> para aceitar ou recusar.</p>`;

    await transporter.sendMail({
      from: `ChatRoom <${smtpFrom}>`,
      to: recipientEmail,
      subject,
      text,
      html,
    });

    const table = kind === 'friend_request' ? 'friend_requests' : 'room_invites';
    const senderColumn = kind === 'friend_request' ? 'requester_id' : 'invited_by';
    const { error: sentUpdateError } = await admin
      .from(table)
      .update({ email_notification_sent_at: new Date().toISOString() })
      .eq('id', id)
      .eq(senderColumn, authResult.user.id)
      .eq('status', 'pending');
    if (sentUpdateError) throw sentUpdateError;

    return jsonResponse({ sent: true });
  } catch (error) {
    console.error('Social invitation email failed:', error);
    return jsonResponse({ error: 'Não foi possível enviar o e-mail de notificação.' }, 500);
  }
});
