// Converte qualquer erro (Error, erro do Supabase, texto ou desconhecido)
// em uma mensagem legível para mostrar ao usuário.
export function friendlyError(
  error: unknown,
  fallback = 'Ocorreu um erro inesperado. Tente novamente.',
): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}

export function socialErrorMessage(error: unknown, fallback: string): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined;

  if (
    typeof code === 'string' &&
    ['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205'].includes(code)
  ) {
    return 'Amizades e convites ainda não estão ativos no servidor. A migração do ChatRoom precisa ser aplicada no Supabase.';
  }

  return fallback;
}

export function directChatErrorMessage(error: unknown, fallback: string): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined;
  const detail = friendlyError(error, fallback);

  if (
    typeof code === 'string' &&
    ['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205'].includes(code)
  ) {
    return `${detail}\n\nAplique no Supabase, em ordem, as migrações de conversas e presença do ChatRoom.`;
  }

  if (typeof code === 'string' && code === '42501' && !detail.includes('só estão disponíveis')) {
    return `${detail}\n\nConfirme se a amizade foi aceita e se as políticas RLS da migração de conversas estão aplicadas.`;
  }

  return detail;
}
