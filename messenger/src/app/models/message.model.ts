export type MessageType = 'text' | 'image' | 'video' | 'audio';

export interface Message {
  id?: string;
  sender_id: string;
  sender_name: string;
  type: MessageType;
  content: string;       // text or public URL
  thumbnail_url?: string;
  created_at?: string;   // ISO string from Supabase
}

export interface User {
  id: string;
  name: string;
  pin: string;
}

export const USERS: User[] = [
  { id: '1', name: 'Юстас', pin: '512' },
  { id: '2', name: 'Алекс', pin: '128' }
];
