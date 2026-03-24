import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { User, USERS } from '../models/message.model';

const STORAGE_KEY = 'messenger_user';

// Only safe fields stored — PIN is never persisted
interface StoredUser { id: string; name: string; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  currentUser = signal<User | null>(this.loadUser());

  constructor(private router: Router) {}

  private loadUser(): User | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const stored: StoredUser = JSON.parse(raw);
      // Re-validate against known users (no PIN in storage)
      return USERS.find(u => u.id === stored.id && u.name === stored.name) ?? null;
    } catch {
      return null;
    }
  }

  login(pin: string): boolean {
    const user = USERS.find(u => u.pin === pin.trim());
    if (user) {
      // Store only id + name, never the PIN
      const safe: StoredUser = { id: user.id, name: user.name };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
      this.currentUser.set(user);
      return true;
    }
    return false;
  }

  logout(): void {
    sessionStorage.removeItem(STORAGE_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    return this.currentUser() !== null;
  }
}
