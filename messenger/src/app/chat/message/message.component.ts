import {
  Component, Input, Output, EventEmitter, signal, HostListener, ElementRef
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Message } from '../../models/message.model';

@Component({
  selector: 'app-message',
  standalone: true,
  imports: [DatePipe, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './message.component.html',
  styleUrl: './message.component.scss'
})
export class MessageComponent {
  @Input() message!: Message;
  @Input() isOwn = false;

  @Output() deleteMsg = new EventEmitter<string>();
  @Output() editMsg = new EventEmitter<{ id: string; content: string }>();

  showActions = signal(false);
  editing = signal(false);
  editText = '';

  private pressTimer: any;

  // ─── Long-press (mobile) ───────────────────────────────────────────────────

  onTouchStart(): void {
    if (!this.isOwn) return;
    this.pressTimer = setTimeout(() => this.showActions.set(true), 500);
  }

  onTouchEnd(): void {
    clearTimeout(this.pressTimer);
  }

  // ─── Click (desktop hover button) ─────────────────────────────────────────

  toggleActions(event: MouseEvent): void {
    event.stopPropagation();
    this.showActions.set(!this.showActions());
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.showActions.set(false);
  }

  // ─── Edit ──────────────────────────────────────────────────────────────────

  startEdit(event: MouseEvent): void {
    event.stopPropagation();
    this.editText = this.message.content;
    this.editing.set(true);
    this.showActions.set(false);
  }

  cancelEdit(): void {
    this.editing.set(false);
  }

  confirmEdit(): void {
    if (this.editText.trim() && this.editText !== this.message.content) {
      this.editMsg.emit({ id: this.message.id!, content: this.editText });
    }
    this.editing.set(false);
  }

  onEditKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.confirmEdit();
    }
    if (event.key === 'Escape') this.cancelEdit();
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  confirmDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.showActions.set(false);
    this.deleteMsg.emit(this.message.id!);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  getTime(): Date {
    return this.message.created_at ? new Date(this.message.created_at) : new Date();
  }

  openMedia(url: string): void {
    window.open(url, '_blank');
  }
}
