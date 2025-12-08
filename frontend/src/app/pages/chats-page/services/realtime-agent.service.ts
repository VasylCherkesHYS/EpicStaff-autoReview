import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PaginatedResponse } from '../../../shared/models/paginated-response';
import {
  RealtimeAgent,
  UpdateRealtimeAgentRequest,
} from '../../staff-page/models/realtime-agent.model';
import { ConfigService } from '../../../services/config/config.service';

@Injectable({
  providedIn: 'root',
})
export class RealtimeAgentService {
  constructor(private http: HttpClient, private configService: ConfigService) {}

  private get apiUrl(): string {
    return this.configService.apiUrl + 'realtime-agents/';
  }

  getRealtimeAgents(): Observable<RealtimeAgent[]> {
    return this.http
      .get<PaginatedResponse<RealtimeAgent>>(this.apiUrl)
      .pipe(map((response: PaginatedResponse<RealtimeAgent>) => response.results));
  }

  getRealtimeAgentById(id: number): Observable<RealtimeAgent> {
    const url: string = `${this.apiUrl}${id}/`;
    return this.http.get<RealtimeAgent>(url);
  }

  updateRealtimeAgent(
    agentId: string,
    agentData: UpdateRealtimeAgentRequest
  ): Observable<RealtimeAgent> {
    const url: string = `${this.apiUrl}${agentId}/`;
    return this.http.put<RealtimeAgent>(url, agentData);
  }

  createRealtimeAgent(
    agentData: UpdateRealtimeAgentRequest
  ): Observable<RealtimeAgent> {
    return this.http.post<RealtimeAgent>(this.apiUrl, agentData);
  }
}
