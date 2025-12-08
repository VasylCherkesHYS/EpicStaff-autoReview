import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnInit,
  Output,
  EventEmitter,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule, NgFor } from '@angular/common';
import { ProjectStoreService } from '../../../../features/projects/services/project-store.service';
import { Project } from '../../../../features/projects/models/project.model';
import { NodeType } from '../../../core/enums/node-type';

@Component({
  selector: 'app-templates-context-menu',
  imports: [CommonModule, NgFor],
  standalone: true,
  template: `
    <div class="templates-container">
      <div class="template-section">
        <button class="create-new-btn" (click)="onCreateNewProject()">
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
          <li
            *ngFor="let project of filteredProjects"
            (click)="onCreateFromTemplate(project)"
          >
            <i class="ti ti-folder"></i>
            <span class="project-name">{{ project.name }}</span>
          </li>
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

      .project-name {
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
export class TemplatesContextMenuComponent implements OnInit {
  @Input() public searchTerm: string = '';
  
  @Output() public nodeSelected: EventEmitter<{
    type: NodeType;
    data: Project;
  }> = new EventEmitter();

  @Output() public createNewProject: EventEmitter<void> = new EventEmitter();

  public projects: Project[] = [];
  public creatingProjectFromTemplateId: number | null = null;

  constructor(
    private projectStore: ProjectStoreService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.projectStore.getProjects().subscribe({
      next: (projects: Project[]) => {
        this.projects = projects;
        this.cdr.markForCheck();
      },
      error: (err: any) => console.error('Error fetching projects:', err),
    });
  }

  public get filteredProjects(): Project[] {
    return this.projects
      .filter((project) => project.isTemplate)
      .filter((project) =>
        project.name.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
  }

  public onProjectClicked(project: Project): void {
    this.nodeSelected.emit({ type: NodeType.PROJECT, data: project });
  }

  public onCreateFromTemplate(template: Project): void {
    if (!template.isTemplate) {
      return;
    }

    if (this.creatingProjectFromTemplateId !== null) {
      return;
    }

    this.creatingProjectFromTemplateId = template.id;
    this.cdr.markForCheck();

    this.projectStore.saveAsProject(template.id).subscribe({
      next: (newProject: Project) => {
        this.nodeSelected.emit({
          type: NodeType.PROJECT,
          data: newProject,
        });
      },
      error: (err: any) => {
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
