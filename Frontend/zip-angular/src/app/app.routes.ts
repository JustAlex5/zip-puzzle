import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'play',
    pathMatch: 'full'
  },
  {
    path: 'play',
    loadComponent: () =>
      import('./features/play/play.component').then(m => m.PlayComponent)
  },
  {
    path: 'play/:levelId',
    loadComponent: () =>
      import('./features/play/play-level.component').then(m => m.PlayLevelComponent)
  },
  {
    path: 'editor',
    loadComponent: () =>
      import('./features/editor/editor.component').then(m => m.EditorComponent)
  },
  {
    path: '**',
    redirectTo: 'play'
  }
];