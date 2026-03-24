import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../services/auth.service';
import { InstallPromptService } from '../../services/install-prompt.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  install = inject(InstallPromptService);

  pin = '';
  error = signal('');
  hide = signal(true);
  showIOSGuide = signal(false);

  constructor() {
    if (this.auth.isLoggedIn()) this.router.navigate(['/chat']);
  }

  onSubmit(): void {
    if (this.auth.login(this.pin)) {
      this.router.navigate(['/chat']);
    } else {
      this.error.set('Неверный PIN-код');
      this.pin = '';
    }
  }

  toggleHide(): void {
    this.hide.set(!this.hide());
  }

  onInstallClick(): void {
    if (this.install.hasNativePrompt()) {
      this.install.promptInstall().subscribe();
    } else if (this.install.isIOS()) {
      this.showIOSGuide.set(!this.showIOSGuide());
    }
  }
}
