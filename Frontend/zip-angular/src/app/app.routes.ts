import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'play', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'play',
    loadComponent: () =>
      import('./features/play/play.component').then((m) => m.PlayComponent),
  },
  {
    path: 'play/:levelId',
    loadComponent: () =>
      import('./features/play/play-level.component').then((m) => m.PlayLevelComponent),
  },
  {
    path: 'editor',
    loadComponent: () =>
      import('./features/editor/editor.component').then((m) => m.EditorComponent),
    canActivate: [authGuard],
  },
  {
    path: 'pvp',
    loadComponent: () =>
      import('./features/pvp/pvp.component').then((m) => m.PvpComponent),
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: 'play' },
];
