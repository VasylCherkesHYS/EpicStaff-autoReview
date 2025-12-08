import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import {
    Agent,
    CreateAgentRequest,
    GetAgentRequest,
    PartialUpdateAgentRequest,
    UpdateAgentRequest,
} from '../models/agent.model';
import { PaginatedResponse } from '../../../shared/models/paginated-response';
import { ConfigService } from '../../../services/config/config.service';

@Injectable({
    providedIn: 'root',
})
export class AgentsService {
    private headers = new HttpHeaders({
        'Content-Type': 'application/json',
    });

    constructor(private http: HttpClient, private configService: ConfigService) {}

    private get apiUrl(): string {
        return this.configService.apiUrl + 'agents/';
    }

    getAgents(): Observable<GetAgentRequest[]> {
        return this.http
            .get<PaginatedResponse<GetAgentRequest>>(this.apiUrl)
            .pipe(map((response) => response.results));
    }

    getAgentsByProjectId(projectId: number): Observable<GetAgentRequest[]> {
        const url = `${this.apiUrl}?crew_id=${projectId}`;
        return this.http
            .get<PaginatedResponse<GetAgentRequest>>(url)
            .pipe(map((response) => response.results));
    }

    getAgentById(agentId: number): Observable<GetAgentRequest> {
        return this.http.get<GetAgentRequest>(`${this.apiUrl}${agentId}/`);
    }

    createAgent(agent: CreateAgentRequest): Observable<GetAgentRequest> {
        return this.http.post<GetAgentRequest>(this.apiUrl, agent, {
            headers: this.headers,
        });
    }

    partialUpdateAgent(agent: PartialUpdateAgentRequest): Observable<PartialUpdateAgentRequest> {
        return this.http.patch<PartialUpdateAgentRequest>(
            `${this.apiUrl}${agent.id}/`,
            agent,
            {
                headers: this.headers,
            }
        );
    }

    updateAgent(agent: UpdateAgentRequest): Observable<UpdateAgentRequest> {
        return this.http.put<UpdateAgentRequest>(
            `${this.apiUrl}${agent.id}/`,
            agent,
            {
                headers: this.headers,
            }
        );
    }

    deleteAgent(agentId: number): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}${agentId}/`, {
            headers: this.headers,
        });
    }

    copyAgent(agent: CreateAgentRequest, agentId: number): Observable<GetAgentRequest> {
        return this.http.post<GetAgentRequest>(
            `${this.apiUrl}${agentId}/copy/`,
            agent,
            {
                headers: this.headers,
            }
        );
    }
}

