import { Injectable, inject, NgZone, signal, OnDestroy } from '@angular/core';
import { Observable, Subscription, from, fromEvent, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { Message, MessageType } from '../models/message.model';
import { AuthService } from './auth.service';
import { supabase } from './supabase.client';

const BUCKET = 'media';

@Injectable({ providedIn: 'root' })
export class ChatService implements OnDestroy {
  private auth = inject(AuthService);
  private zone = inject(NgZone);

  readonly messages = signal<Message[]>([]);
  readonly loading = signal(true);

  private lastTimestamp: string | null = null;
  private pollId: ReturnType<typeof setInterval> | null = null;
  private channel: any;
  private visibilitySub: Subscription;

  constructor() {
    this.fetchAll().subscribe();

    this.channel = supabase
      .channel('messages-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' },
        () => this.zone.run(() => this.fetchAll().subscribe()))
      .subscribe();

    this.pollId = setInterval(() => {
      if (document.visibilityState === 'visible') this.fetchNew().subscribe();
    }, 5000);

    this.visibilitySub = fromEvent(document, 'visibilitychange').subscribe(() => {
      if (document.visibilityState === 'visible') this.zone.run(() => this.fetchAll().subscribe());
    });
  }

  private fetchAll(): Observable<void> {
    return from(
      supabase.from('messages').select('*').order('created_at', { ascending: true })
    ).pipe(
      tap(({ data, error }) => {
        if (error) return;
        const msgs = (data ?? []) as Message[];
        this.lastTimestamp = msgs.length ? (msgs[msgs.length - 1].created_at ?? null) : null;
        this.messages.set(msgs);
        this.loading.set(false);
      }),
      map(() => void 0),
      catchError(() => of(void 0))
    );
  }

  private fetchNew(): Observable<void> {
    if (!this.lastTimestamp) return this.fetchAll();
    return from(
      supabase.from('messages').select('*')
        .gt('created_at', this.lastTimestamp)
        .order('created_at', { ascending: true })
    ).pipe(
      tap(({ data, error }) => {
        if (error) return;
        const newMsgs = (data ?? []) as Message[];
        if (newMsgs.length) {
          const merged = [...this.messages(), ...newMsgs];
          this.lastTimestamp = merged[merged.length - 1].created_at ?? null;
          this.messages.set(merged);
        }
      }),
      map(() => void 0),
      catchError(() => of(void 0))
    );
  }

  sendTextMessage(text: string): Observable<void> {
    const user = this.auth.currentUser();
    if (!user || !text.trim()) return of(void 0);
    return from(
      supabase.from('messages').insert({
        sender_id: user.id,
        sender_name: user.name,
        type: 'text' as MessageType,
        content: text.trim()
      })
    ).pipe(
      switchMap(({ error }) => {
        if (error) throw error;
        return this.fetchAll();
      })
    );
  }

  updateMessage(id: string, content: string): Observable<void> {
    return from(
      supabase.from('messages').update({ content: content.trim() }).eq('id', id)
    ).pipe(
      switchMap(({ error }) => {
        if (error) throw error;
        return this.fetchAll();
      })
    );
  }

  deleteMessage(id: string): Observable<void> {
    return from(
      supabase.from('messages').delete().eq('id', id)
    ).pipe(
      switchMap(({ error }) => {
        if (error) throw error;
        return this.fetchAll();
      })
    );
  }

  uploadMedia(file: Blob, type: MessageType, ext: string): Observable<void> {
    const user = this.auth.currentUser();
    if (!user) return of(void 0);
    const filename = `${type}/${Date.now()}.${ext}`;
    return from(
      supabase.storage.from(BUCKET).upload(filename, file, { cacheControl: '3600', upsert: false })
    ).pipe(
      switchMap(({ error: uploadError }) => {
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filename);
        return from(supabase.from('messages').insert({
          sender_id: user.id,
          sender_name: user.name,
          type,
          content: urlData.publicUrl
        }));
      }),
      switchMap(({ error: insertError }) => {
        if (insertError) throw insertError;
        return this.fetchAll();
      })
    );
  }

  ngOnDestroy(): void {
    if (this.channel) supabase.removeChannel(this.channel);
    if (this.pollId !== null) clearInterval(this.pollId);
    this.visibilitySub.unsubscribe();
  }
}
