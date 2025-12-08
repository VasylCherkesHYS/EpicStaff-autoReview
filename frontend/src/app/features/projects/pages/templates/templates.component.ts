import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { ProjectStoreService } from '../../services/project-store.service';
import { Project } from '../../models/project.model';
import { SearchService } from '../../../../shared/services/search.service';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-templates',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LoadingSpinnerComponent],
  template: `
    @if (!store.loadedSig()) {
      <app-loading-spinner size="md" message="Loading templates..."></app-loading-spinner>
    } @else if (filteredTemplates().length === 0) {
      <p class="templates__empty">No templates available yet.</p>
    } @else {
      <div class="templates__grid">
        @for (template of filteredTemplates(); track template.id) {
          <div class="templates__card">{{ template.name }}</div>
        }
      </div>
    }
  `,
  styles: [`
    .templates {
      &__empty {
        padding: 1rem;
        color: var(--color-text-secondary);
      }

      &__grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 1rem;
      }

      &__card {
        padding: 1rem;
        background: var(--color-sidenav-background);
        border-radius: 8px;
        color: var(--color-text-primary);
      }
    }
  `],
})
export class TemplatesComponent {
  private readonly searchService = inject(SearchService);
  readonly store = inject(ProjectStoreService);

  readonly filteredTemplates = computed(() => {
    const templates = this.store.templatesSig();
    const term = this.searchService.searchTerm();

    if (!term) return templates;
    return templates.filter((t: Project) => t.name.toLowerCase().includes(term.toLowerCase()));
  });

  constructor() {
    this.store.getProjects().subscribe();
  }
}
