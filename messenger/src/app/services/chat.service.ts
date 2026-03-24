import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  query,
  orderBy,
  collectionData,
  serverTimestamp
} from '@angular/fire/firestore';
import {
  Storage,
  ref,
  uploadBytes,
  getDownloadURL
} from '@angular/fire/storage';
import { Observable } from 'rxjs';
import { Message, MessageType } from '../models/message.model';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private firestore = inject(Firestore);
  private storage = inject(Storage);
  private auth = inject(AuthService);

  getMessages(): Observable<Message[]> {
    const col = collection(this.firestore, 'messages');
    const q = query(col, orderBy('timestamp', 'asc'));
    return collectionData(q, { idField: 'id' }) as Observable<Message[]>;
  }

  async sendTextMessage(text: string): Promise<void> {
    const user = this.auth.currentUser();
    if (!user || !text.trim()) return;
    const col = collection(this.firestore, 'messages');
    await addDoc(col, {
      senderId: user.id,
      senderName: user.name,
      type: 'text' as MessageType,
      content: text.trim(),
      timestamp: serverTimestamp()
    });
  }

  async uploadMedia(file: Blob, type: MessageType, ext: string): Promise<void> {
    const user = this.auth.currentUser();
    if (!user) return;

    const filename = `${Date.now()}.${ext}`;
    const storageRef = ref(this.storage, `media/${type}/${filename}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    const col = collection(this.firestore, 'messages');
    await addDoc(col, {
      senderId: user.id,
      senderName: user.name,
      type,
      content: url,
      timestamp: serverTimestamp()
    });
  }
}
