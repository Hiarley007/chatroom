// Edge Function: grava o convite (o RLS só deixa membros da sala) e envia o e-mail.
//
// Secrets necessários (supabase secrets set ...):
//   RESEND_API_KEY   chave do provedor de e-mail (Resend)
//   INVITE_FROM      remetente, ex.: ChatRoom <convites@seudominio.com>
//   INVITE_BASE_URL  página que abre o app, ex.: https://SEU-USUARIO.github.io/chatroom/join/
// SUPABASE_URL e SUPABASE_ANON_KEY já existem no ambiente das Edge Functions.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildInviteEmail, buildInviteLink, isUuid, isValidEmail } from './email.ts';

const MAX_INVITES_PER_DAY = 20;
const VALID_DAYS = 7;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('INVITE_FROM');
  const baseUrl = Deno.env.get('INVITE_BASE_URL');
  if (!apiKey || !from || !baseUrl)
    return json({ error: 'Envio de e-mail não configurado.' }, 500);

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'Faça login para convidar.' }, 401);

  const body = await req.json().catch(() => null);
  const roomId = body?.roomId;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!isUuid(roomId)) return json({ error: 'Sala inválida.' }, 400);
  if (!isValidEmail(email)) return json({ error: 'E-mail inválido.' }, 400);

  // Cliente com o JWT de quem chamou: todas as consultas passam pelo RLS dessa pessoa.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: { headers: { Authorization: authorization } },
    },
  );

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user)
    return json({ error: 'Sessão inválida. Entre de novo.' }, 401);

  // Limite diário por pessoa (anti-spam).
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('room_invites')
    .select('id', { count: 'exact', head: true })
    .eq('invited_by', auth.user.id)
    .gte('created_at', since);
  if ((count ?? 0) >= MAX_INVITES_PER_DAY) {
    return json({ error: 'Limite de convites por dia atingido. Tente amanhã.' }, 429);
  }

  const [{ data: room }, { data: inviter }] = await Promise.all([
    supabase.from('rooms').select('name, emoji').eq('id', roomId).maybeSingle(),
    supabase.from('profiles').select('username').eq('id', auth.user.id).maybeSingle(),
  ]);
  if (!room) return json({ error: 'Sala não encontrada.' }, 404);

  // O RLS recusa (42501) quem não é membro da sala.
  const { data: invite, error: insertError } = await supabase
    .from('room_invites')
    .insert({ room_id: roomId, email })
    .select('id, token')
    .single();
  if (insertError) {
    if (insertError.code === '42501')
      return json({ error: 'Só quem participa da sala pode convidar.' }, 403);
    return json({ error: 'Não foi possível criar o convite.' }, 500);
  }

  const message = buildInviteEmail({
    roomName: room.name,
    roomEmoji: room.emoji,
    inviterName: inviter?.username ?? 'Alguém',
    link: buildInviteLink(baseUrl, invite.token),
    validDays: VALID_DAYS,
  });

  const sent = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [email],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  }).catch(() => null);

  if (!sent || !sent.ok) {
    // Não deixa convite "fantasma" que ninguém recebeu.
    await supabase.from('room_invites').delete().eq('id', invite.id);
    return json({ error: 'Não foi possível enviar o e-mail. Tente novamente.' }, 502);
  }

  return json({ ok: true });
});
