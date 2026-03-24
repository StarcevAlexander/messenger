import { Timestamp } from '@angular/fire/firestore';

export type MessageType = 'text' | 'image' | 'video' | 'audio';

export interface Message {
  id?: string;
  senderId: string;
  senderName: string;
  type: MessageType;
  content: string;       // text or download URL
  thumbnailUrl?: string; // for video
  timestamp: Timestamp | Date;
}

export interface User {
  id: string;
  name: string;
  pin: string;
}

export const USERS: User[] = [
  { id: '1', name: 'User 1', pin: '123' },
  { id: '2', name: 'User 2', pin: '412' }
];
