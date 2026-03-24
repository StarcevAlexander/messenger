import { Component, Input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Message } from '../../models/message.model';

@Component({
  selector: 'app-message',
  standalone: true,
  imports: [DatePipe, MatIconModule],
  templateUrl: './message.component.html',
  styleUrl: './message.component.scss'
})
export class MessageComponent {
  @Input() message!: Message;
  @Input() isOwn = false;

  getTime(): Date {
    return this.message.created_at ? new Date(this.message.created_at) : new Date();
  }

  openMedia(url: string): void {
    window.open(url, '_blank');
  }
}
