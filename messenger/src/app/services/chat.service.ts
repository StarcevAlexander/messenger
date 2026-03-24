import { Injectable, inject, NgZone, signal, OnDestroy } from '@angular/core';
import { fromEvent, Subscription } from 'rxjs';
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
    this.fetchAll();

    this.channel = supabase
      .channel('messages-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' },
        () => this.zone.run(() => this.fetchAll()))
      .subscribe();

    this.pollId = setInterval(() => {
      if (document.visibilityState === 'visible') this.fetchNew();
    }, 5000);

    this.visibilitySub = fromEvent(document, 'visibilitychange').subscribe(() => {
      if (document.visibilityState === 'visible') this.zone.run(() => this.fetchAll());
    });
  }

  private async fetchAll(): Promise<void> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) return;
    const msgs = (data ?? []) as Message[];
    this.lastTimestamp = msgs.length ? (msgs[msgs.length - 1].created_at ?? null) : null;
    this.messages.set(msgs);
    this.loading.set(false);
  }

  private async fetchNew(): Promise<void> {
    if (!this.lastTimestamp) { this.fetchAll(); return; }
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .gt('created_at', this.lastTimestamp)
      .order('created_at', { ascending: true });
    if (error) return;
    const newMsgs = (data ?? []) as Message[];
    if (newMsgs.length) {
      const merged = [...this.messages(), ...newMsgs];
      this.lastTimestamp = merged[merged.length - 1].created_at ?? null;
      this.messages.set(merged);
    }
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
    await this.fetchAll();
  }

  async updateMessage(id: string, content: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .update({ content: content.trim() })
      .eq('id', id);
    if (error) throw error;
    await this.fetchAll();
  }

  async deleteMessage(id: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', id);
    if (error) throw error;
    await this.fetchAll();
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
    await this.fetchAll();
  }

  ngOnDestroy(): void {
    if (this.channel) supabase.removeChannel(this.channel);
    if (this.pollId !== null) clearInterval(this.pollId);
    this.visibilitySub.unsubscribe();
  }
}
