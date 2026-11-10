// Funções puras da Edge Function send-invite (sem Deno, sem rede): ficam num
// arquivo à parte para poderem ser testadas com Jest.

export const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const isValidEmail = (email: string): boolean =>
  email.length >= 5 && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

// Link https do e-mail. A página em docs/join/ abre o app em chatroom://join/<token>.
export const buildInviteLink = (baseUrl: string, token: string): string =>
  `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}t=${encodeURIComponent(token)}`;

interface InviteEmailInput {
  roomName: string;
  roomEmoji: string;
  inviterName: string;
  link: string;
  validDays: number;
}

export function buildInviteEmail({
  roomName,
  roomEmoji,
  inviterName,
  link,
  validDays,
}: InviteEmailInput) {
  const room = `${roomEmoji} ${roomName}`;
  const subject = `${inviterName} convidou você para a sala ${roomName}`;
  const text =
    `${inviterName} convidou você para a sala "${room}" no ChatRoom.\n\n` +
    `Abra o link para entrar (vale por ${validDays} dias, só para este e-mail):\n${link}\n`;
  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;background:#F8FAFC;font-family:Arial,Helvetica,sans-serif;color:#0F172A">
  <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;padding:32px">
    <h1 style="margin:0 0 8px;font-size:22px">Você foi convidado!</h1>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.5"><strong>${escapeHtml(inviterName)}</strong> convidou você para a sala <strong>${escapeHtml(room)}</strong> no ChatRoom.</p>
    <p style="margin:0 0 24px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#2563EB;color:#FFFFFF;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:999px">Entrar na sala</a></p>
    <p style="margin:0;font-size:13px;color:#566579;line-height:1.5">O convite vale por ${validDays} dias e só funciona com este e-mail. Se você não esperava por ele, ignore esta mensagem.</p>
  </div>
</body></html>`;
  return { subject, html, text };
}
