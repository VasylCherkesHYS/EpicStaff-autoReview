import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import {
  PythonCodeToolConfig,
  CreatePythonCodeToolConfigRequest,
  UpdatePythonCodeToolConfigRequest,
} from '../../models/tool_config.model';
import { ApiGetRequest } from '../../../../shared/models/api-request.model';
import { ConfigService } from '../../../../services/config/config.service';

@Injectable({
  providedIn: 'root',
})
export class PythonCodeToolConfigService {
  private readonly http = inject(HttpClient);
  private readonly configService = inject(ConfigService);

  private readonly httpHeaders = new HttpHeaders({
    'Content-Type': 'application/json',
  });

  private get baseUrl(): string {
    return `${this.configService.apiUrl}python-code-tool-configs/`;
  }

  getConfigs(toolId?: number): Observable<PythonCodeToolConfig[]> {
    const url = toolId ? `${this.baseUrl}?tool=${toolId}` : this.baseUrl;
    return this.http
      .get<ApiGetRequest<PythonCodeToolConfig>>(url)
      .pipe(map((response) => response.results));
  }

  getConfigById(id: number): Observable<PythonCodeToolConfig> {
    return this.http.get<PythonCodeToolConfig>(`${this.baseUrl}${id}/`, {
      headers: this.httpHeaders,
    });
  }

  createConfig(
    config: CreatePythonCodeToolConfigRequest
  ): Observable<PythonCodeToolConfig> {
    return this.http.post<PythonCodeToolConfig>(this.baseUrl, config, {
      headers: this.httpHeaders,
    });
  }

  updateConfig(
    id: number,
    config: UpdatePythonCodeToolConfigRequest
  ): Observable<PythonCodeToolConfig> {
    return this.http.put<PythonCodeToolConfig>(`${this.baseUrl}${id}/`, config, {
      headers: this.httpHeaders,
    });
  }

  deleteConfig(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}${id}/`, {
      headers: this.httpHeaders,
    });
  }
}

