import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { forkJoin, map, Observable, tap } from 'rxjs';
import {
  Agent,
  CreateAgentRequest,
  GetAgentRequest,
  PartialUpdateAgentRequest,
  UpdateAgentRequest,
} from '../shared/models/agent.model';
import { ApiGetRequest } from '../shared/models/api-request.model';
import { GetProjectRequest } from '../features/projects/models/project.model';
import { ConfigService } from './config/config.service';

@Injectable({
  providedIn: 'root',
})
export class AgentsService {
  private headers = new HttpHeaders({
    'Content-Type': 'application/json',
  });

  constructor(private http: HttpClient, private configService: ConfigService) {}

  // Dynamically retrieve the API URL from ConfigService
  private get apiUrl(): string {
    return this.configService.apiUrl + 'agents/';
  }

  // GET all agents
  getAgents(): Observable<GetAgentRequest[]> {
    const url = this.apiUrl;
    return this.http
      .get<ApiGetRequest<GetAgentRequest>>(url)
      .pipe(map((response) => response.results));
  }

  // GET agents by project (crew) ID
  getAgentsByProjectId(projectId: number): Observable<GetAgentRequest[]> {
    const url = `${this.apiUrl}?crew_id=${projectId}`;
    return this.http
      .get<ApiGetRequest<GetAgentRequest>>(url)
      .pipe(map((response) => response.results));
  }

  getAgentById(agentId: number): Observable<GetAgentRequest> {
    return this.http.get<GetAgentRequest>(`${this.apiUrl}${agentId}/`);
  }

  // POST create agent
  createAgent(agent: CreateAgentRequest): Observable<GetAgentRequest> {
    console.log('🚀 [AgentService] CREATE Agent - Request Payload:', {
      tool_ids: agent.tool_ids,
      fullPayload: agent,
    });
    return this.http.post<GetAgentRequest>(this.apiUrl, agent, {
      headers: this.headers,
    }).pipe(
      tap((response) => {
        console.log('✅ [AgentService] CREATE Agent - Response:', {
          tools: response.tools,
          fullResponse: response,
        });
      })
    );
  }

  // PATCH update agent
  partialUpdateAgent(agent: PartialUpdateAgentRequest): Observable<PartialUpdateAgentRequest> {
    console.log('🚀 [AgentService] PATCH Agent - Request Payload:', {
      id: agent.id,
      tool_ids: agent.tool_ids,
      fullPayload: agent,
    });
    return this.http.patch<PartialUpdateAgentRequest>(
      `${this.apiUrl}${agent.id}/`,
      agent,
      {
        headers: this.headers,
      }
    ).pipe(
      tap((response) => {
        console.log('✅ [AgentService] PATCH Agent - Response:', {
          fullResponse: response,
        });
      })
    );
  }

  // PUT update agent
  updateAgent(agent: UpdateAgentRequest): Observable<UpdateAgentRequest> {
    console.log('🚀 [AgentService] PUT Agent - Request Payload:', {
      id: agent.id,
      tool_ids: agent.tool_ids,
      fullPayload: agent,
    });
    return this.http.put<UpdateAgentRequest>(
      `${this.apiUrl}${agent.id}/`,
      agent,
      {
        headers: this.headers,
      }
    ).pipe(
      tap((response) => {
        console.log('✅ [AgentService] PUT Agent - Response:', {
          fullResponse: response,
        });
      })
    );
  }

  // DELETE agent
  deleteAgent(agentId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}${agentId}/`, {
      headers: this.headers,
    });
  }

  // COPY agent
  copyAgent(agent: CreateAgentRequest,agentId: number): Observable<GetAgentRequest> {
    return this.http.post<GetAgentRequest>(
      `${this.apiUrl}${agentId}/copy/`,
      agent,
      {
        headers: this.headers,
      });
  }
}
