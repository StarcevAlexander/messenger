import {
  Component, OnInit, OnDestroy, inject, signal, ViewChild, ElementRef, AfterViewChecked
} from '@angular/core';
import { Subscription } from 'rxjs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../services/auth.service';
import { ChatService } from '../services/chat.service';
import { Message } from '../models/message.model';
import { MessageComponent } from './message/message.component';
import { MessageInputComponent } from './message-input/message-input.component';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MessageComponent,
    MessageInputComponent
  ],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss'
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messageList') messageList!: ElementRef<HTMLDivElement>;

  auth = inject(AuthService);
  private chatService = inject(ChatService);

  messages = signal<Message[]>([]);
  loading = signal(true);

  private sub?: Subscription;
  private shouldScroll = false;

  ngOnInit(): void {
    this.sub = this.chatService.getMessages().subscribe(msgs => {
      this.messages.set(msgs);
      this.loading.set(false);
      this.shouldScroll = true;
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  isOwn(msg: Message): boolean {
    return msg.senderId === this.auth.currentUser()?.id;
  }

  private scrollToBottom(): void {
    const el = this.messageList?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  logout(): void {
    this.auth.logout();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
