import { friendlyError } from './errors';

// Os serviços de convite já lançam mensagens prontas para a pessoa ("Limite de
// convites por dia atingido", "Convite inválido, expirado..."): mostre-as como estão.
export function inviteErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : friendlyError(error);
}
