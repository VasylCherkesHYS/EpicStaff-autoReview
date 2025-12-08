import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { ProjectCardComponent } from '../../components/project-card/project-card.component';
import { AddProjectCardComponent } from './add-project-card/add-project-card.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { CreateProjectComponent } from '../../components/create-project-form-dialog/create-project.component';
import { ConfirmationDialogService } from '../../../../shared/components/cofirm-dialog/confimation-dialog.service';
import { ProjectStoreService } from '../../services/project-store.service';
import { Project } from '../../models/project.model';
import { SearchService } from '../../../../shared/services/search.service';

@Component({
  selector: 'app-my-projects',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProjectCardComponent, AddProjectCardComponent, LoadingSpinnerComponent],
  template: `
    <div class="my-projects">
      @if (!store.loadedSig()) {
        <app-loading-spinner size="md" message="Loading templates..."></app-loading-spinner>
      } @else {
        <div class="my-projects__grid">
          <app-add-project-card (createClick)="onCreateProject()"></app-add-project-card>

          @if (filteredProjects().length === 0) {
            <div class="my-projects__empty">
              <p>No templates found. Create your first template to get started.</p>
            </div>
          } @else {
            @for (project of filteredProjects(); track project.id) {
              <app-project-card
                [project]="project"
                (cardClick)="onOpenProject(project.id)"
                (actionClick)="handleAction($event)"
              ></app-project-card>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .my-projects {
      &__grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(335px, 1fr));
        gap: 1.5rem;
      }

      &__empty {
        grid-column: 1 / -1;
        padding: 2rem;
        text-align: center;
        font-size: 1.1rem;
        color: var(--color-text-secondary);
        background: var(--color-sidenav-background);
        border-radius: 8px;
      }
    }
  `],
})
export class MyProjectsComponent {
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  private readonly confirmDialog = inject(ConfirmationDialogService);
  private readonly searchService = inject(SearchService);

  readonly store = inject(ProjectStoreService);

  readonly filteredProjects = computed(() => {
    const templates = this.store.templatesSig();
    const term = this.searchService.searchTerm();

    let filtered = templates;
    if (term) {
      filtered = filtered.filter((p: Project) => p.name.toLowerCase().includes(term.toLowerCase()));
    }
    return filtered.sort((a: Project, b: Project) => b.id - a.id);
  });

  constructor() {
    this.store.getProjects().subscribe();
  }

  onOpenProject(id: number): void {
    this.router.navigate(['/projects', id]);
  }

  onCreateProject(): void {
    const dialogRef = this.dialog.open<Project | undefined>(CreateProjectComponent, {
      maxWidth: '95vw',
      maxHeight: '90vh',
      autoFocus: true,
    });

    dialogRef.closed.subscribe((result) => {
      if (result) {
        this.router.navigate(['/projects', result.id]);
      }
    });
  }

  handleAction(event: { action: string; project: Project }): void {
    const { action, project } = event;

    switch (action) {
      case 'copy':
        this.store.copy(project.id).subscribe();
        break;
      case 'edit':
        this.router.navigate(['/projects', project.id, 'edit']);
        break;
      case 'delete':
        this.confirmDelete(project);
        break;
    }
  }

  private confirmDelete(project: Project): void {
    this.confirmDialog.confirmDeleteWithTruncation(project.name, 50).subscribe((confirmed) => {
      if (confirmed === true) {
        this.store.delete(project.id).subscribe();
      }
    });
  }
}
