import { Injectable, signal } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class InstallPromptService {
  private deferredPrompt = signal<any>(null);

  constructor() {
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt.set(e);
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt.set(null);
    });
  }

  isInstalled(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );
  }

  isIOS(): boolean {
    return (
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !(window as any).MSStream
    );
  }

  showInstallButton(): boolean {
    if (this.isInstalled()) return false;
    if (this.deferredPrompt() !== null) return true;
    if (this.isIOS()) return true;
    return false;
  }

  hasNativePrompt(): boolean {
    return this.deferredPrompt() !== null;
  }

  promptInstall(): Observable<void> {
    const prompt = this.deferredPrompt();
    if (!prompt) return of(void 0);
    return from(prompt.prompt() as Promise<void>).pipe(
      switchMap(() => from(prompt.userChoice as Promise<any>)),
      map(() => {
        this.deferredPrompt.set(null);
      })
    );
  }
}
