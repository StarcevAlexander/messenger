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
      // Initial load
      supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .then(({ data, error }) => {
          if (error) return observer.error(error);
          observer.next((data ?? []) as Message[]);
        });

      // Real-time subscription
      const channel = supabase
        .channel('messages-channel')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          payload => {
            this.zone.run(() => {
              supabase
                .from('messages')
                .select('*')
                .order('created_at', { ascending: true })
                .then(({ data }) => {
                  if (data) observer.next(data as Message[]);
                });
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
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

  async uploadMedia(file: Blob, type: MessageType, ext: string): Promise<void> {
    const user = this.auth.currentUser();
    if (!user) return;

    const filename = `${type}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filename, file, { cacheControl: '3600', upsert: false });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(filename);

    const { error: insertError } = await supabase.from('messages').insert({
      sender_id: user.id,
      sender_name: user.name,
      type,
      content: urlData.publicUrl
    });
    if (insertError) throw insertError;
  }
}
