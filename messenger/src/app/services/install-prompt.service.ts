import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class InstallPromptService {
  private deferredPrompt = signal<any>(null);

  constructor() {
    // Android / Chrome / Edge: перехватываем нативный промпт
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt.set(e);
    });

    // После установки сбрасываем
    window.addEventListener('appinstalled', () => {
      this.deferredPrompt.set(null);
    });
  }

  /** Запущено ли приложение как PWA (установлено) */
  isInstalled(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );
  }

  /** iOS Safari */
  isIOS(): boolean {
    return (
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !(window as any).MSStream
    );
  }

  /** Показывать ли кнопку «Установить» */
  showInstallButton(): boolean {
    if (this.isInstalled()) return false;
    // Android/Chrome — есть нативный промпт
    if (this.deferredPrompt() !== null) return true;
    // iOS — нет автопромпта, показываем инструкцию
    if (this.isIOS()) return true;
    return false;
  }

  /** Нативный промпт (Android/Chrome) или null (iOS) */
  hasNativePrompt(): boolean {
    return this.deferredPrompt() !== null;
  }

  /** Вызвать установку (только Android/Chrome) */
  async promptInstall(): Promise<void> {
    const prompt = this.deferredPrompt();
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    this.deferredPrompt.set(null);
  }
}
