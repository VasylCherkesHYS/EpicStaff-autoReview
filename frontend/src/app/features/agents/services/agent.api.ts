import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ConfigService } from '../../../services/config/config.service';
import { PaginatedResponse } from '../../../shared/models/paginated-response';
import { Agent, AgentResponse } from '../models/agent.model';

@Injectable({ providedIn: 'root' })
export class AgentApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  private get url(): string {
    return this.config.apiUrl + 'agents/';
  }

  getAgents(): Observable<Agent[]> {
    return this.http
      .get<PaginatedResponse<AgentResponse>>(this.url)
      .pipe(map((res) => res.results.map(Agent.fromResponse)));
  }

  getAgentById(id: number): Observable<Agent> {
    return this.http
      .get<AgentResponse>(`${this.url}${id}/`)
      .pipe(map(Agent.fromResponse));
  }

  create(agent: Agent): Observable<Agent> {
    return this.http
      .post<AgentResponse>(this.url, agent.toPayload())
      .pipe(map(Agent.fromResponse));
  }

  update(agent: Agent): Observable<Agent> {
    return this.http
      .patch<AgentResponse>(`${this.url}${agent.id}/`, agent.toPayload())
      .pipe(map(Agent.fromResponse));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}${id}/`);
  }

  copy(id: number): Observable<Agent> {
    return this.http
      .post<AgentResponse>(`${this.url}${id}/copy/`, {})
      .pipe(map(Agent.fromResponse));
  }
}

