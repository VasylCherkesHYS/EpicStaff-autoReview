import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';

import { ApiGetRequest } from '../../../../shared/models/api-request.model';
import {
  CreateToolConfigRequest,
  GetToolConfigRequest,
  ToolConfig,
} from '../../models/tool_config.model';
import { ConfigService } from '../../../../services/config/config.service';

@Injectable({
  providedIn: 'root',
})
export class ToolConfigService {
  private readonly http = inject(HttpClient);
  private readonly configService = inject(ConfigService);

  private readonly headers = new HttpHeaders({ 'Content-Type': 'application/json' });

  private get apiUrl(): string {
    return this.configService.apiUrl + 'tool-configs/';
  }

  getToolConfigs(): Observable<GetToolConfigRequest[]> {
    const params = new HttpParams().set('limit', '1000');
    return this.http
      .get<ApiGetRequest<GetToolConfigRequest>>(this.apiUrl, {
        headers: this.headers,
        params,
      })
      .pipe(map((res) => res.results));
  }

  createToolConfig(config: CreateToolConfigRequest): Observable<ToolConfig> {
    return this.http.post<ToolConfig>(this.apiUrl, config, {
      headers: this.headers,
    });
  }

  updateToolConfig(
    id: number,
    config: CreateToolConfigRequest
  ): Observable<ToolConfig> {
    return this.http.put<ToolConfig>(`${this.apiUrl}${id}/`, config, {
      headers: this.headers,
    });
  }

  deleteToolConfig(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}${id}/`, {
      headers: this.headers,
    });
  }
}

