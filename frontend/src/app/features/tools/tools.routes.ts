import { Routes } from '@angular/router';
import { SearchService, SEARCH_CONFIG } from '../../shared/services/search.service';

export const TOOLS_ROUTES: Routes = [
  {
    path: '',
    providers: [
      { provide: SEARCH_CONFIG, useValue: { debounceMs: 300, minLength: 0 } },
      SearchService,
    ],
    loadComponent: () =>
      import('./pages/tools-list-page/tools-list-page.component').then(
        (m) => m.ToolsListPageComponent
      ),
    children: [
      { path: '', redirectTo: 'built-in', pathMatch: 'full' },
      {
        path: 'built-in',
        loadComponent: () =>
          import('./pages/built-in-tools/built-in-tools.component').then(
            (m) => m.BuiltInToolsComponent
          ),
      },
      {
        path: 'custom',
        loadComponent: () =>
          import('./pages/custom-tools/custom-tools.component').then(
            (m) => m.CustomToolsComponent
          ),
      },
      {
        path: 'mcp',
        loadComponent: () =>
          import('./pages/mcp-tools/mcp-tools.component').then(
            (m) => m.McpToolsComponent
          ),
      },
    ],
  },
];

