import { Component, HostListener, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { KONAMI_KEYS, normalizeKonamiKey } from './core/utils/konami.util';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private konamiProgress = 0;

  logout(): void {
    this.auth.logout();
  }

  @HostListener('document:keydown', ['$event'])
  onKonami(e: KeyboardEvent): void {
    if (this.router.url.includes('/3110')) {
      return;
    }
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    if ((e.target as HTMLElement).isContentEditable) {
      return;
    }
    const key = normalizeKonamiKey(e);
    const expected = KONAMI_KEYS[this.konamiProgress];
    if (key === expected) {
      this.konamiProgress += 1;
      if (this.konamiProgress >= KONAMI_KEYS.length) {
        this.konamiProgress = 0;
        void this.router.navigateByUrl('/3110');
      }
    } else {
      this.konamiProgress = key === KONAMI_KEYS[0] ? 1 : 0;
    }
  }
}
