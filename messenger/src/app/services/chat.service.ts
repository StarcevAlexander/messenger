import { Injectable, inject, NgZone } from '@angular/core';
import { Observable } from 'rxjs';
import { Message, MessageType } from '../models/message.model';
import { AuthService } from './auth.service';
import { supabase } from './supabase.client';

const BUCKET = 'media';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private auth = inject(AuthService);
  private zone = inject(NgZone);

  getMessages(): Observable<Message[]> {
    return new Observable(observer => {
      let current: Message[] = [];

      // Initial load
      supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .then(({ data, error }) => {
          if (error) return observer.error(error);
          current = (data ?? []) as Message[];
          observer.next(current);
        });

      // Real-time: INSERT, UPDATE, DELETE
      const channel = supabase
        .channel('messages-rt')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
          payload => this.zone.run(() => {
            current = [...current, payload.new as Message];
            observer.next(current);
          }))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' },
          payload => this.zone.run(() => {
            current = current.map(m => m.id === (payload.new as Message).id ? payload.new as Message : m);
            observer.next(current);
          }))
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' },
          payload => this.zone.run(() => {
            current = current.filter(m => m.id !== (payload.old as any).id);
            observer.next(current);
          }))
        .subscribe();

      return () => supabase.removeChannel(channel);
    });
  }

  async sendTextMessage(text: string): Promise<void> {
    const user = this.auth.currentUser();
    if (!user || !text.trim()) return;
    const { error } = await supabase.from('messages').insert({
      sender_id: user.id,
      sender_name: user.name,
      type: 'text' as MessageType,
      content: text.trim()
    });
    if (error) throw error;
  }

  async updateMessage(id: string, content: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .update({ content: content.trim() })
      .eq('id', id);
    if (error) throw error;
  }

  async deleteMessage(id: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  async uploadMedia(file: Blob, type: MessageType, ext: string): Promise<void> {
    const user = this.auth.currentUser();
    if (!user) return;

    const filename = `${type}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filename, file, { cacheControl: '3600', upsert: false });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filename);
    const { error: insertError } = await supabase.from('messages').insert({
      sender_id: user.id,
      sender_name: user.name,
      type,
      content: urlData.publicUrl
    });
    if (insertError) throw insertError;
  }
}
