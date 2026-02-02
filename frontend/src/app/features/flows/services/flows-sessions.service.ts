import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { ConfigService } from '../../../services/config/config.service';
import { PaginatedResponse } from '../../../shared/models/paginated-response';
import {
  GraphSession,
  GraphSessionLight,
  GraphSessionStatus,
  GraphSessionStatusesCounts,
  RunGraphResponse,
  SessionStatusesCounts,
  SessionStatusesCountsMap,
  SessionUpdates,
  defaultSessionStatusesCounts,
} from '../models/session.model';

@Injectable({
  providedIn: 'root',
})
export class GraphSessionService {
  constructor(private http: HttpClient, private configService: ConfigService) {}

  private get apiUrl(): string {
    return this.configService.apiUrl + 'sessions/';
  }

  private get runGraphUrl(): string {
    return this.configService.apiUrl + 'run-session/';
  }

  runGraph(graphId: number, initialState?: any): Observable<RunGraphResponse> {
    const formData = new FormData();
    formData.append('graph_id', graphId.toString());
    formData.append('initial_state', JSON.stringify(initialState || {}));

    return this.http.post<RunGraphResponse>(this.runGraphUrl, formData);
  }

  getAllSessions(): Observable<GraphSession[]> {
    return this.http.get<PaginatedResponse<GraphSession>>(this.apiUrl).pipe(
      map((response) => {
        return response.results.sort((a, b) => b.id - a.id);
      })
    );
  }

  getSessionStatuses(graphId?: string): Observable<SessionStatusesCountsMap> {
    const params = new HttpParams().set('graph_id', graphId!.toString());
    return this.http
      .get<GraphSessionStatusesCounts>(this.apiUrl + 'statuses/', { params })
      .pipe(
        map((response) => {
          const outerMap: SessionStatusesCountsMap = new Map();
          Object.entries(response).forEach(([graphId, statuses]) => {
            const normalizedStatuses: SessionStatusesCounts = {
              ...defaultSessionStatusesCounts(),
              ...statuses,
            };
            outerMap.set(graphId, normalizedStatuses);
          });
          return outerMap;
        })
      );
  }

  getSessionById(sessionId: number): Observable<GraphSession> {
    return this.http.get<GraphSession>(`${this.apiUrl}${sessionId}/`);
  }

  getSessionUpdates(sessionId: string): Observable<SessionUpdates> {
    return this.http.get<SessionUpdates>(`${this.apiUrl}${sessionId}/get-updates/`);
  }

  getSessionsByGraphId(
    graphId: number,
    options?: { limit?: number; offset?: number; status?: string[] }
  ): Observable<PaginatedResponse<GraphSession>> {
    const { limit, offset, status } = options || {};
    let params = new HttpParams().set('graph_id', graphId.toString());

    if (limit !== undefined) params = params.set('limit', limit.toString());
    if (offset !== undefined) params = params.set('offset', offset.toString());
    if (status !== undefined && !status.includes('all'))
      params = params.set('status', status.join(','));

    return this.http.get<PaginatedResponse<GraphSession>>(this.apiUrl, {
      params,
    });
  }

  getSessionsLightByGraphId(
    graphId: number,
    options?: { limit?: number; offset?: number; status?: string[] }
  ): Observable<PaginatedResponse<GraphSessionLight>> {
    const { limit, offset, status } = options || {};
    let params = new HttpParams().set('graph_id', graphId.toString());

    params = params.set('detailed', 'false');
    if (limit !== undefined) params = params.set('limit', limit.toString());
    if (offset !== undefined) params = params.set('offset', offset.toString());
    if (status !== undefined && !status.includes('all'))
      params = params.set('status', status.join(','));

    return this.http.get<PaginatedResponse<GraphSessionLight>>(this.apiUrl, {
      params,
    });
  }

  deleteSessionById(sessionId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}${sessionId}/`);
  }

  bulkDeleteSessions(ids: number[]): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}bulk_delete/`, { ids });
  }

  stopSessionById(sessionId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}${sessionId}/stop/`, {});
  }
}
