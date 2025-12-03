import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, of, tap } from 'rxjs';
import { AgentApi } from './agent.api';
import { Agent } from '../models/agent.model';

@Injectable({ providedIn: 'root' })
export class AgentStore {
  private readonly api = inject(AgentApi);

  private readonly _agentsSig = signal<Agent[] | null>(null);

  readonly agentsSig = computed(() => this._agentsSig() ?? []);
  readonly loadedSig = computed(() => this._agentsSig() !== null);
  readonly templatesSig = computed(() => this.agentsSig().filter((a) => a.isTemplate));
  readonly myAgentsSig = computed(() => this.agentsSig().filter((a) => !a.isTemplate));

  getAgents(fresh = false): Observable<Agent[]> {
    if (this._agentsSig() && !fresh) {
      return of(this.agentsSig());
    }
    return this.api.getAgents().pipe(tap((agents) => this._agentsSig.set(agents)));
  }

  getAgentById(id: number): Observable<Agent> {
    const cached = this._agentsSig()?.find((a) => a.id === id);
    if (cached) {
      return of(cached);
    }
    return this.api.getAgentById(id).pipe(
      tap((agent) => {
        this._agentsSig.update((a) => {
          const exists = (a ?? []).some((x) => x.id === id);
          if (!exists) {
            return [...(a ?? []), agent];
          }
          return (a ?? []).map((x) => (x.id === id ? agent : x));
        });
      })
    );
  }

  create(agent: Agent): Observable<Agent> {
    return this.api.create(agent).pipe(
      tap((created) => {
        this._agentsSig.update((a) => [...(a ?? []), created]);
      })
    );
  }

  update(agent: Agent): Observable<Agent> {
    return this.api.update(agent).pipe(
      tap((updated) => {
        this._agentsSig.update((a) =>
          (a ?? []).map((x) => (x.id === updated.id ? updated : x))
        );
      })
    );
  }

  delete(id: number): Observable<void> {
    return this.api.delete(id).pipe(
      tap(() => {
        this._agentsSig.update((a) => (a ?? []).filter((x) => x.id !== id));
      })
    );
  }

  copy(id: number): Observable<Agent> {
    return this.api.copy(id).pipe(
      tap((copied) => {
        this._agentsSig.update((a) => [...(a ?? []), copied]);
      })
    );
  }
}

