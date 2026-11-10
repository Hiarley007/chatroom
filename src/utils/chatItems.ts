import type { Message } from '@/types';
import { groupMessagesByDay, shouldGroupWithPrevious } from './messages';

export type ChatItem =
  | { type: 'day'; key: string; label: string }
  | { type: 'message'; key: string; message: Message; showSender: boolean };

// Transforma a lista de mensagens numa lista única para o FlatList:
// separador de dia ("Hoje", "Ontem"...) seguido das mensagens daquele dia.
// O agrupamento por autor recomeça a cada dia.
export function buildChatItems(messages: Message[], now: Date = new Date()): ChatItem[] {
  const items: ChatItem[] = [];
  for (const section of groupMessagesByDay(messages, now)) {
    items.push({
      type: 'day',
      key: `day-${section.label}-${section.messages[0]?.id ?? ''}`,
      label: section.label,
    });
    section.messages.forEach((message, index) => {
      items.push({
        type: 'message',
        key: message.id,
        message,
        showSender: !shouldGroupWithPrevious(message, section.messages[index - 1]),
      });
    });
  }
  return items;
}
