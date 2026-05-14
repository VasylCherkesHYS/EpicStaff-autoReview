import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, input, OnInit, output } from '@angular/core';

import { GetProjectRequest } from '../../../../features/projects/models/project.model';
import { ProjectsStorageService } from '../../../../features/projects/services/projects-storage.service';
import { NodeType } from '../../../core/enums/node-type';
import { CreateNodeRequest } from '../../../core/models/node-creation.types';

@Component({
    selector: 'app-flow-templates-context-menu',
    standalone: true,
    template: `
        <div class="templates-container">
            <div class="template-section">
                <button
                    type="button"
                    class="create-new-btn"
                    (click)="onCreateNewProject()"
                >
                    <i class="ti ti-plus"></i>
                    <span>Create New Project</span>
                </button>
            </div>

            <div class="template-section">
                <div class="section-title">
                    <i class="ti ti-copy"></i>
                    <span>Create from Template</span>
                </div>
                <ul>
                    @for (template of filteredTemplates; track template.id) {
                        <li (click)="onCreateFromTemplate(template)">
                            <i class="ti ti-folder"></i>
                            <span class="template-name">{{ template.name }}</span>
                        </li>
                    } @empty {
                        <li class="empty">No templates yet</li>
                    }
                </ul>
            </div>
        </div>
    `,
    styles: [
        `
            .templates-container {
                display: flex;
                flex-direction: column;
                gap: 0;
            }

            .template-section {
                border-bottom: 1px solid #3a3a3a;
            }

            .template-section:last-child {
                border-bottom: none;
            }

            .section-title {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 12px 16px;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                color: #888;
                letter-spacing: 0.5px;
            }

            .section-title i {
                color: #fff;
            }

            ul {
                list-style: none;
                padding: 0;
                margin: 0;
            }

            li {
                display: flex;
                align-items: center;
                padding: 12px 16px;
                cursor: pointer;
                transition: background 0.2s ease;
                gap: 16px;
                overflow: hidden;
            }

            li:hover {
                background: #2a2a2a;
                color: #fff;
            }

            li i {
                font-size: 18px;
                color: #fff;
            }

            li.empty {
                cursor: default;
                color: #8b8e98;
                font-size: 13px;
                justify-content: center;
            }

            li.empty:hover {
                background: transparent;
                color: #8b8e98;
            }

            .template-name {
                flex: 1;
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
            }

            .create-new-btn {
                display: flex;
                align-items: center;
                gap: 16px;
                width: 100%;
                padding: 12px 16px;
                border: none;
                background: transparent;
                color: #fff;
                cursor: pointer;
                font-size: 14px;
                transition: background 0.2s ease;
                text-align: left;
            }

            .create-new-btn:hover {
                background: #2a2a2a;
            }

            .create-new-btn i {
                font-size: 18px;
                color: #fff;
            }
        `,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlowTemplatesContextMenuComponent implements OnInit {
    public readonly searchTerm = input('');
    public readonly nodeSelected = output<CreateNodeRequest>();
    public readonly createNewProject = output<void>();

    private readonly projectsService = inject(ProjectsStorageService);
    private readonly cdr = inject(ChangeDetectorRef);

    public projects: GetProjectRequest[] = [];
    public creatingProjectFromTemplateId: number | null = null;

    public ngOnInit(): void {
        this.projectsService.getProjects().subscribe({
            next: (projects: GetProjectRequest[]) => {
                this.projects = projects;
                this.cdr.markForCheck();
            },
            error: (err) => console.error('Error fetching projects:', err),
        });
    }

    public get filteredTemplates(): GetProjectRequest[] {
        const term = this.searchTerm().toLowerCase();
        return this.projects
            .filter((project) => project.is_template)
            .filter((project) => project.name.toLowerCase().includes(term));
    }

    public onCreateFromTemplate(template: GetProjectRequest): void {
        if (!template.is_template) {
            console.warn('Attempted to create a project from a non-template project.', template);
            return;
        }

        if (this.creatingProjectFromTemplateId !== null) {
            return;
        }

        this.creatingProjectFromTemplateId = template.id;
        this.cdr.markForCheck();

        this.projectsService.saveAsProject(template.id).subscribe({
            next: (newProject) => {
                this.nodeSelected.emit({
                    type: NodeType.PROJECT,
                    overrides: { data: newProject },
                });
            },
            error: (err) => {
                console.error('Error creating project from template:', err);
                this.creatingProjectFromTemplateId = null;
                this.cdr.markForCheck();
            },
            complete: () => {
                this.creatingProjectFromTemplateId = null;
                this.cdr.markForCheck();
            },
        });
    }

    public onCreateNewProject(): void {
        this.createNewProject.emit();
    }
}
