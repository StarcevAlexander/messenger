import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { User, USERS } from '../models/message.model';

const STORAGE_KEY = 'messenger_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  currentUser = signal<User | null>(this.loadUser());

  constructor(private router: Router) {}

  private loadUser(): User | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  login(pin: string): boolean {
    const user = USERS.find(u => u.pin === pin.trim());
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      this.currentUser.set(user);
      return true;
    }
    return false;
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    return this.currentUser() !== null;
  }
}
