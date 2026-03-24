import {
  Component, ElementRef, OnDestroy, ViewChild, inject, signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ChatService } from '../../services/chat.service';

type CaptureMode = 'none' | 'photo' | 'video' | 'audio';

@Component({
  selector: 'app-message-input',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './message-input.component.html',
  styleUrl: './message-input.component.scss'
})
export class MessageInputComponent implements OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('videoInput') videoInput!: ElementRef<HTMLInputElement>;
  @ViewChild('cameraPreview') cameraPreview!: ElementRef<HTMLVideoElement>;
  @ViewChild('recordedVideo') recordedVideo!: ElementRef<HTMLVideoElement>;

  private chat = inject(ChatService);

  text = '';
  loading = signal(false);
  captureMode = signal<CaptureMode>('none');
  useFrontCamera = signal(false);
  capturedBlob = signal<Blob | null>(null);
  capturedUrl = signal<string>('');

  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  isRecording = signal(false);
  recordingSeconds = signal(0);
  private recordingTimer: any = null;

  // ─── Text ──────────────────────────────────────────────────────────────────

  async sendText(): Promise<void> {
    if (!this.text.trim()) return;
    this.loading.set(true);
    try {
      await this.chat.sendTextMessage(this.text);
      this.text = '';
    } finally {
      this.loading.set(false);
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendText();
    }
  }

  // ─── File upload ───────────────────────────────────────────────────────────

  triggerFileInput(type: 'image' | 'video'): void {
    const el = type === 'image' ? this.fileInput : this.videoInput;
    el.nativeElement.click();
  }

  async onFileSelected(event: Event, type: 'image' | 'video'): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.loading.set(true);
    try {
      const ext = file.name.split('.').pop() || (type === 'image' ? 'jpg' : 'mp4');
      await this.chat.uploadMedia(file, type, ext);
    } finally {
      this.loading.set(false);
      (event.target as HTMLInputElement).value = '';
    }
  }

  // ─── Camera capture ────────────────────────────────────────────────────────

  async openCamera(mode: 'photo' | 'video'): Promise<void> {
    this.captureMode.set(mode);
    this.capturedBlob.set(null);
    this.capturedUrl.set('');
    await this.startStream();
  }

  private async startStream(): Promise<void> {
    this.stopStream();
    const facingMode = this.useFrontCamera() ? 'user' : 'environment';
    const constraints: MediaStreamConstraints = {
      video: { facingMode },
      audio: this.captureMode() === 'video'
    };
    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      setTimeout(() => {
        if (this.cameraPreview?.nativeElement && this.stream) {
          this.cameraPreview.nativeElement.srcObject = this.stream;
        }
      }, 50);
    } catch (err) {
      console.error('Camera error', err);
      alert('Не удалось получить доступ к камере');
      this.captureMode.set('none');
    }
  }

  async flipCamera(): Promise<void> {
    this.useFrontCamera.set(!this.useFrontCamera());
    await this.startStream();
  }

  takePhoto(): void {
    const video = this.cameraPreview?.nativeElement;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      this.capturedBlob.set(blob);
      this.capturedUrl.set(URL.createObjectURL(blob));
      this.stopStream();
    }, 'image/jpeg', 0.9);
  }

  startVideoRecord(): void {
    if (!this.stream) return;
    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream);
    this.mediaRecorder.ondataavailable = e => this.chunks.push(e.data);
    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: 'video/webm' });
      this.capturedBlob.set(blob);
      this.capturedUrl.set(URL.createObjectURL(blob));
    };
    this.mediaRecorder.start();
    this.isRecording.set(true);
    this.recordingSeconds.set(0);
    this.recordingTimer = setInterval(() => this.recordingSeconds.update(s => s + 1), 1000);
  }

  stopVideoRecord(): void {
    this.mediaRecorder?.stop();
    this.isRecording.set(false);
    clearInterval(this.recordingTimer);
    this.stopStream();
  }

  async sendCaptured(): Promise<void> {
    const blob = this.capturedBlob();
    if (!blob) return;
    const mode = this.captureMode();
    this.loading.set(true);
    try {
      if (mode === 'photo') {
        await this.chat.uploadMedia(blob, 'image', 'jpg');
      } else {
        await this.chat.uploadMedia(blob, 'video', 'webm');
      }
      this.closeCapture();
    } finally {
      this.loading.set(false);
    }
  }

  closeCapture(): void {
    this.stopStream();
    this.captureMode.set('none');
    this.capturedBlob.set(null);
    if (this.capturedUrl()) {
      URL.revokeObjectURL(this.capturedUrl());
      this.capturedUrl.set('');
    }
    this.isRecording.set(false);
    clearInterval(this.recordingTimer);
  }

  // ─── Voice recording ───────────────────────────────────────────────────────

  async startVoice(): Promise<void> {
    this.chunks = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.stream = stream;
      this.mediaRecorder = new MediaRecorder(stream);
      this.mediaRecorder.ondataavailable = e => this.chunks.push(e.data);
      this.mediaRecorder.onstop = async () => {
        const blob = new Blob(this.chunks, { type: 'audio/webm' });
        this.loading.set(true);
        try {
          await this.chat.uploadMedia(blob, 'audio', 'webm');
        } finally {
          this.loading.set(false);
        }
        this.stopStream();
      };
      this.mediaRecorder.start();
      this.isRecording.set(true);
      this.captureMode.set('audio');
      this.recordingSeconds.set(0);
      this.recordingTimer = setInterval(() => this.recordingSeconds.update(s => s + 1), 1000);
    } catch {
      alert('Не удалось получить доступ к микрофону');
    }
  }

  stopVoice(): void {
    this.mediaRecorder?.stop();
    this.isRecording.set(false);
    this.captureMode.set('none');
    clearInterval(this.recordingTimer);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private stopStream(): void {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
  }

  formatTime(sec: number): string {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  ngOnDestroy(): void {
    this.stopStream();
    clearInterval(this.recordingTimer);
  }
}
