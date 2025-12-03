import { Routes } from '@angular/router';
import { SearchService, SEARCH_CONFIG } from '../../shared/services/search.service';

export const PROJECTS_ROUTES: Routes = [
  {
    path: '',
    providers: [
      { provide: SEARCH_CONFIG, useValue: { debounceMs: 300, minLength: 0 } },
      SearchService,
    ],
    loadComponent: () =>
      import('./pages/projects-list-page/projects-list-page.component').then(
        (m) => m.ProjectsListPageComponent
      ),
    children: [
      { path: '', redirectTo: 'my', pathMatch: 'full' },
      {
        path: 'my',
        loadComponent: () =>
          import('./pages/my-projects/my-projects.component').then(
            (m) => m.MyProjectsComponent
          ),
      },
      {
        path: 'templates',
        loadComponent: () =>
          import('./pages/templates/templates.component').then(
            (m) => m.TemplatesComponent
          ),
      },
    ],
  },
];

