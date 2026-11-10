export type InviteStatus = 'pending' | 'accepted' | 'expired';

interface InviteDates {
  acceptedAt: string | null;
  expiresAt: string;
}

export function inviteStatus(invite: InviteDates, now: Date = new Date()): InviteStatus {
  if (invite.acceptedAt) return 'accepted';
  return new Date(invite.expiresAt).getTime() > now.getTime() ? 'pending' : 'expired';
}

export const INVITE_STATUS_LABEL: Record<InviteStatus, string> = {
  pending: 'Pendente',
  accepted: 'Aceito',
  expired: 'Expirado',
};

// dd/mm/aaaa no fuso do aparelho.
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
