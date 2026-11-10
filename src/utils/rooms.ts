import type { Room } from '@/types';

// Minúsculas e sem acentos: "Café" encontra "cafe".
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function filterRooms(rooms: Room[], query: string): Room[] {
  const q = normalizeText(query);
  if (!q) return rooms;
  return rooms.filter((r) => normalizeText(`${r.name} ${r.description}`).includes(q));
}

export interface RoomSection {
  key: 'mine' | 'discover';
  title: string;
  data: Room[];
}

// Separa em "Minhas salas" e "Descobrir". Seções vazias não aparecem.
export function splitRooms(rooms: Room[], myRoomIds: Set<string>): RoomSection[] {
  const mine = rooms.filter((r) => myRoomIds.has(r.id));
  const discover = rooms.filter((r) => !myRoomIds.has(r.id));
  const sections: RoomSection[] = [
    { key: 'mine', title: 'Minhas salas', data: mine },
    { key: 'discover', title: 'Descobrir', data: discover },
  ];
  return sections.filter((s) => s.data.length > 0);
}
