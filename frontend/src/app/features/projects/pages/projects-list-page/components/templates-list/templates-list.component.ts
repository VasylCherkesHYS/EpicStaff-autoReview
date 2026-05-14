import { Dialog } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ConfirmationDialogService } from '../../../../../../shared/components/cofirm-dialog/confimation-dialog.service';
import { LoadingSpinnerComponent } from '../../../../../../shared/components/loading-spinner/loading-spinner.component';
import { CreateProjectComponent } from '../../../../components/create-project-form-dialog/create-project.component';
import { ProjectCardComponent } from '../../../../components/project-card/project-card.component';
import { GetProjectRequest } from '../../../../models/project.model';
import { ProjectTagsStorageService } from '../../../../services/project-tags-storage.service';
import { ProjectsStorageService } from '../../../../services/projects-storage.service';
import { AddProjectCardComponent } from './add-project-card/add-project-card.component';

@Component({
    selector: 'app-templates-list',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="templates-grid">
            @if (!isProjectsLoaded()) {
                <app-loading-spinner
                    size="md"
                    message="Loading templates..."
                ></app-loading-spinner>
            } @else {
                @if (error()) {
                    <div class="error">{{ error() }}</div>
                    <button
                        type="button"
                        (click)="ngOnInit()"
                    >
                        Retry
                    </button>
                } @else {
                    <div class="grid">
                        <app-add-project-card
                            label="Create New Template"
                            (createClick)="onCreateTemplate()"
                        ></app-add-project-card>

                        @if (filteredTemplates().length === 0) {
                            <div class="empty-message">
                                <p>No templates yet. Create your first template to get started.</p>
                            </div>
                        } @else {
                            @for (template of filteredTemplates(); track template.id) {
                                <app-project-card
                                    [project]="template"
                                    (cardClick)="onOpenTemplate(template.id)"
                                    (actionClick)="handleTemplateAction($event)"
                                >
                                </app-project-card>
                            }
                        }
                    </div>
                }
            }
        </div>
    `,
    styles: [
        `
            .templates-grid {
                display: flex;
                flex-direction: column;
            }

            .grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(clamp(10vw, 100%, 335px), 1fr));
                gap: 1.5rem;
                width: 100%;
                align-items: start;
            }
            .empty-message {
                grid-column: 1 / -1;
                text-align: center;
                padding: 2rem;
                color: var(--color-text-secondary);
                font-size: 1.1rem;
                background: var(--color-sidenav-background);
                border-radius: 8px;
                margin-top: 1rem;
            }
            .error {
                font-size: 1.1rem;
                color: #d32f2f;
                margin-top: 2rem;
            }
        `,
    ],
    imports: [ProjectCardComponent, AddProjectCardComponent, LoadingSpinnerComponent],
})
export class TemplatesListComponent implements OnInit {
    private readonly router = inject(Router);
    private readonly projectsStorageService = inject(ProjectsStorageService);
    private readonly projectTagsStorageService = inject(ProjectTagsStorageService);
    private readonly dialog = inject(Dialog);
    private readonly confirmationDialogService = inject(ConfirmationDialogService);

    public readonly error = signal<string | null>(null);
    public readonly filteredTemplates = this.projectsStorageService.filteredTemplates;
    public readonly isProjectsLoaded = this.projectsStorageService.isProjectsLoaded;

    constructor() {
        this.projectsStorageService.getProjects().subscribe();
        this.projectTagsStorageService.ensureLoaded().subscribe();
    }

    public ngOnInit(): void {
        if (!this.projectsStorageService.isProjectsLoaded()) {
            this.projectsStorageService.getProjects().subscribe({
                next: () => {},
                error: (err: HttpErrorResponse) => {
                    console.error('Error loading templates', err);
                    this.error.set('Failed to load templates. Please try again later.');
                },
            });
        }
    }

    public onOpenTemplate(id: number): void {
        this.router.navigate(['/templates', id]);
    }

    public onCreateTemplate(): void {
        const dialogRef = this.dialog.open<GetProjectRequest | undefined>(CreateProjectComponent, {
            maxWidth: '95vw',
            maxHeight: '90vh',
            autoFocus: true,
            data: { isTemplate: true },
        });
        dialogRef.closed.subscribe((result: GetProjectRequest | undefined) => {
            if (result) {
                this.router.navigate(['/templates', result.id]);
            }
        });
    }

    public handleTemplateAction(event: { action: string; project: GetProjectRequest }): void {
        const { action, project } = event;

        switch (action) {
            case 'run':
                break;
            case 'copy':
                this.projectsStorageService.copyProject(project.id).subscribe();
                break;
            case 'edit':
                this.router.navigate(['/templates', project.id, 'edit']);
                break;
            case 'delete':
                this.confirmAndDeleteTemplate(project);
                break;
        }
    }

    private confirmAndDeleteTemplate(template: GetProjectRequest): void {
        this.confirmationDialogService.confirmDeleteWithTruncation(template.name, 50).subscribe((result) => {
            if (result === true) {
                this.projectsStorageService.deleteProject(template.id).subscribe({
                    error: (err) => {
                        console.error(`Error deleting template ${template.id} - ${template.name}`, err);
                    },
                });
            }
        });
    }
}
