import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { AgentCardComponent } from '../../components/agent-card/agent-card.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AgentStore } from '../../services/agent.store';
import { Agent } from '../../models/agent.model';
import { SearchService } from '../../../../shared/services/search.service';

@Component({
  selector: 'app-my-agents',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgentCardComponent, LoadingSpinnerComponent],
  template: `
    <div class="my-agents">
      @if (!store.loadedSig()) {
        <app-loading-spinner size="md" message="Loading agents..."></app-loading-spinner>
      } @else {
        <div class="my-agents__grid">
          @if (filteredAgents().length === 0) {
            <div class="my-agents__empty">
              <p>No agents found.</p>
            </div>
          } @else {
            @for (agent of filteredAgents(); track agent.id) {
              <app-agent-card [agent]="agent" (cardClick)="onAgentClick(agent)"></app-agent-card>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .my-agents {
      &__grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
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
export class MyAgentsComponent {
  private readonly searchService = inject(SearchService);
  readonly store = inject(AgentStore);

  readonly filteredAgents = computed(() => {
    const agents = this.store.myAgentsSig();
    const term = this.searchService.searchTerm();

    let filtered = agents;
    if (term) {
      filtered = filtered.filter((a: Agent) => a.role.toLowerCase().includes(term.toLowerCase()));
    }
    return filtered.sort((a: Agent, b: Agent) => b.id - a.id);
  });

  constructor() {
    this.store.getAgents().subscribe();
  }

  onAgentClick(agent: Agent): void {
    console.log('Agent clicked:', agent);
  }
}

