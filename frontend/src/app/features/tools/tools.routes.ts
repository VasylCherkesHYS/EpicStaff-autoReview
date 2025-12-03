import { Routes } from '@angular/router';

export const TOOLS_ROUTES: Routes = [
  {
    path: '',
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

