import { Injectable, inject, NgZone } from '@angular/core';
import { Observable, Subject, fromEvent, merge } from 'rxjs';
import { Message, MessageType } from '../models/message.model';
import { AuthService } from './auth.service';
import { supabase } from './supabase.client';

const BUCKET = 'media';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private auth = inject(AuthService);
  private zone = inject(NgZone);

  /** Ручной триггер обновления (после отправки/удаления/редактирования) */
  private refresh$ = new Subject<void>();

  getMessages(): Observable<Message[]> {
    return new Observable(observer => {
      let messages: Message[] = [];
      let lastTimestamp: string | null = null;

      // Полная загрузка всех сообщений
      const fetchAll = () =>
        supabase
          .from('messages')
          .select('*')
          .order('created_at', { ascending: true })
          .then(({ data, error }) => {
            if (error) return observer.error(error);
            messages = (data ?? []) as Message[];
            lastTimestamp = messages.length ? (messages[messages.length - 1].created_at ?? null) : null;
            observer.next(messages);
          });

      // Только новые сообщения (для polling)
      const fetchNew = () => {
        if (!lastTimestamp) return fetchAll();
        return supabase
          .from('messages')
          .select('*')
          .gt('created_at', lastTimestamp)
          .order('created_at', { ascending: true })
          .then(({ data, error }) => {
            if (error) return observer.error(error);
            const newMsgs = (data ?? []) as Message[];
            if (newMsgs.length) {
              messages = [...messages, ...newMsgs];
              lastTimestamp = messages[messages.length - 1].created_at ?? null;
              observer.next(messages);
            }
          });
      };

      // Начальная загрузка
      fetchAll();

      // После ручных операций (send/delete/update) — полный рефреш
      const refreshSub = this.refresh$.subscribe(() =>
        this.zone.run(() => fetchAll())
      );

      // Realtime Supabase — полный рефреш (если репликация включена)
      const channel = supabase
        .channel('messages-rt')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' },
          () => this.zone.run(() => fetchAll()))
        .subscribe();

      // Polling каждые 5 сек — только новые сообщения
      const pollId = setInterval(() => {
        if (document.visibilityState === 'visible') fetchNew();
      }, 5000);

      // При возврате на вкладку — полный рефреш
      const visibilitySub = fromEvent(document, 'visibilitychange').subscribe(() => {
        if (document.visibilityState === 'visible') this.zone.run(() => fetchAll());
      });

      return () => {
        supabase.removeChannel(channel);
        refreshSub.unsubscribe();
        visibilitySub.unsubscribe();
        clearInterval(pollId);
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
    this.refresh$.next();
  }

  async updateMessage(id: string, content: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .update({ content: content.trim() })
      .eq('id', id);
    if (error) throw error;
    this.refresh$.next();
  }

  async deleteMessage(id: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', id);
    if (error) throw error;
    this.refresh$.next();
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
    this.refresh$.next();
  }
}
