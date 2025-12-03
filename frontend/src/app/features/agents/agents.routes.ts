import { Routes } from '@angular/router';
import { SearchService, SEARCH_CONFIG } from '../../shared/services/search.service';

export const AGENTS_ROUTES: Routes = [
  {
    path: '',
    providers: [
      { provide: SEARCH_CONFIG, useValue: { debounceMs: 300, minLength: 0 } },
      SearchService,
    ],
    loadComponent: () =>
      import('./pages/agents-list-page/agents-list-page.component').then(
        (m) => m.AgentsListPageComponent
      ),
    children: [
      { path: '', redirectTo: 'my', pathMatch: 'full' },
      {
        path: 'my',
        loadComponent: () =>
          import('./pages/my-agents/my-agents.component').then(
            (m) => m.MyAgentsComponent
          ),
      },
      {
        path: 'templates',
        loadComponent: () =>
          import('./pages/templates/templates.component').then(
            (m) => m.AgentTemplatesComponent
          ),
      },
    ],
  },
];

