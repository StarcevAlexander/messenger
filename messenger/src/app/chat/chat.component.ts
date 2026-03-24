import {
  Component, inject, ViewChild, ElementRef, AfterViewChecked, effect
} from '@angular/core';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
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
    MatSnackBarModule,
    MessageComponent,
    MessageInputComponent
  ],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss'
})
export class ChatComponent implements AfterViewChecked {
  @ViewChild('messageList') messageList!: ElementRef<HTMLDivElement>;

  auth = inject(AuthService);
  chatService = inject(ChatService);
  private snack = inject(MatSnackBar);

  private shouldScroll = false;
  private prevCount = 0;

  constructor() {
    effect(() => {
      const msgs = this.chatService.messages();
      if (msgs.length !== this.prevCount) {
        this.prevCount = msgs.length;
        this.shouldScroll = true;
      }
    });
  }

  isOwn(msg: Message): boolean {
    return msg.sender_id === this.auth.currentUser()?.id;
  }

  onDelete(id: string): void {
    this.chatService.deleteMessage(id).pipe(
      catchError(() => {
        this.snack.open('Ошибка удаления', 'OK', { duration: 3000 });
        return of(void 0);
      })
    ).subscribe();
  }

  onEdit(event: { id: string; content: string }): void {
    this.chatService.updateMessage(event.id, event.content).pipe(
      catchError(() => {
        this.snack.open('Ошибка редактирования', 'OK', { duration: 3000 });
        return of(void 0);
      })
    ).subscribe();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  private scrollToBottom(): void {
    const el = this.messageList?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  logout(): void {
    this.auth.logout();
  }
}
