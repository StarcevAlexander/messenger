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

  openMedia(url: string): void {
    window.open(url, '_blank');
  }

  getTime(): Date {
    const ts = this.message.timestamp as any;
    if (ts?.toDate) return ts.toDate();
    if (ts instanceof Date) return ts;
    return new Date();
  }
}
