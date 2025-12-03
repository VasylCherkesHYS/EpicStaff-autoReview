import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { AgentCardComponent } from '../../components/agent-card/agent-card.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AgentStore } from '../../services/agent.store';
import { Agent } from '../../models/agent.model';
import { SearchService } from '../../../../shared/services/search.service';

@Component({
  selector: 'app-agent-templates',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgentCardComponent, LoadingSpinnerComponent],
  template: `
    <div class="templates">
      @if (!store.loadedSig()) {
        <app-loading-spinner size="md" message="Loading templates..."></app-loading-spinner>
      } @else if (filteredTemplates().length === 0) {
        <p class="templates__empty">No agent templates available yet.</p>
      } @else {
        <div class="templates__grid">
          @for (template of filteredTemplates(); track template.id) {
            <app-agent-card [agent]="template" (cardClick)="onTemplateClick(template)"></app-agent-card>
          }
        </div>
      }
    </div>
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
    }
  `],
})
export class AgentTemplatesComponent {
  private readonly searchService = inject(SearchService);
  readonly store = inject(AgentStore);

  readonly filteredTemplates = computed(() => {
    const templates = this.store.templatesSig();
    const term = this.searchService.searchTerm();

    if (!term) return templates;
    return templates.filter((t: Agent) => t.role.toLowerCase().includes(term.toLowerCase()));
  });

  constructor() {
    this.store.getAgents().subscribe();
  }

  onTemplateClick(template: Agent): void {
    console.log('Template clicked:', template);
  }
}

