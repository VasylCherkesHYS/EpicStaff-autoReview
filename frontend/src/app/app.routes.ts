import { Routes } from '@angular/router';
import { MainLayoutComponent } from './layouts/main-layout/main-layout.component';

import { OpenProjectPageComponent } from './open-project-page/open-project-page.component';

import { FlowVisualProgrammingComponent } from './pages/flows-page/components/flow-visual-programming/flow-visual-programming.component';
import { StaffPageComponent } from './pages/staff-page/staff-page.component';
import { RunningGraphComponent } from './pages/running-graph/running-graph-page.component';
import { KnowledgeSourcesComponent } from './pages/knowledge-sources/knowledge-sources.component';
import { ChatsPageComponent } from './pages/chats-page/chats-page.component';

import { MyFlowsComponent } from './features/flows/pages/flows-list-page/components/my-flows/my-flows.component';
import { FlowTemplatesComponent } from './features/flows/pages/flows-list-page/components/flow-templates/flow-templates.component';
import { UnsavedChangesGuard } from './core/guards/unsaved-changes.guard';
import { FlowsListPageComponent } from './features/flows/pages/flows-list-page/flows-list-page.component';
import {
    CollectionsListPageComponent
} from "./features/knowledge-sources/pages/collections-list-page/collections-list-page.component";

export const routes: Routes = [
    {
        path: '',
        component: MainLayoutComponent,
        children: [
            {
                path: '',
                redirectTo: 'projects',
                pathMatch: 'full',
            },
            {
                path: 'projects',
        loadChildren: () =>
          import('./features/projects/projects.routes').then(
            (m) => m.PROJECTS_ROUTES
          ),
            },
            {
                path: 'projects/:projectId',
                component: OpenProjectPageComponent,
            },
            {
                path: 'agents',
                loadChildren: () =>
                    import('./features/agents/agents.routes').then(
                        (m) => m.AGENTS_ROUTES
                    ),
            },
            {
                path: 'staff',
                component: StaffPageComponent,
            },
            {
                path: 'tools',
                loadChildren: () =>
                    import('./features/tools/tools.routes').then(
                        (m) => m.TOOLS_ROUTES
                    ),
            },
            {
                path: 'flows',
                component: FlowsListPageComponent,
                children: [
                    { path: '', redirectTo: 'my', pathMatch: 'full' },
                    { path: 'my', component: MyFlowsComponent },
                    { path: 'templates', component: FlowTemplatesComponent },
                ],
            },
            {
                path: 'flows/:id',
                component: FlowVisualProgrammingComponent,
                canDeactivate: [UnsavedChangesGuard],
            },
            {
                path: 'graph/:graphId/session/:sessionId',
                component: RunningGraphComponent,
            },
            {
                path: 'knowledge-sources',
                component: CollectionsListPageComponent,
            },
            {
                path: 'chats',
                component: ChatsPageComponent,
            },

            { path: '**', redirectTo: '' },
        ],
    },
];
