import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'chatroom:pending-invite';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isInviteToken = (value: unknown): value is string =>
  typeof value === 'string' && UUID.test(value);

// Quem abre o link sem estar logado é levado ao login. Guardamos o token para
// retomar o convite assim que a sessão existir.
export async function savePendingInvite(token: string): Promise<void> {
  if (!isInviteToken(token)) return;
  try {
    await AsyncStorage.setItem(KEY, token);
  } catch {
    // sem armazenamento: o convite precisará ser aberto de novo depois do login
  }
}

// Lê e apaga: cada convite pendente é retomado uma única vez.
export async function takePendingInvite(): Promise<string | null> {
  try {
    const token = await AsyncStorage.getItem(KEY);
    if (token) await AsyncStorage.removeItem(KEY);
    return isInviteToken(token) ? token : null;
  } catch {
    return null;
  }
}
