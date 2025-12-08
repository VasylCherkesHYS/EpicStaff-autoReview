import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { map, Observable } from 'rxjs';
  import { PythonCodeToolConfigField } from '../../models/python-code-tool.model';
import { ApiGetRequest } from '../../../../shared/models/api-request.model';
import { ConfigService } from '../../../../services/config/config.service';

export interface CreateConfigFieldRequest {
  tool: number;
  name: string;
  description: string;
  data_type: string;
  required: boolean;
  secret: boolean;
}

export interface UpdateConfigFieldRequest {
  tool: number;
  name: string;
  description: string;
  data_type: string;
  required: boolean;
  secret: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class PythonCodeToolConfigFieldService {
  private readonly http = inject(HttpClient);
  private readonly configService = inject(ConfigService);

  private readonly httpHeaders = new HttpHeaders({
    'Content-Type': 'application/json',
  });

  private get baseUrl(): string {
    return `${this.configService.apiUrl}python-code-tool-config-fields/`;
  }

  getFieldsByTool(toolId: number): Observable<PythonCodeToolConfigField[]> {
    return this.http
      .get<ApiGetRequest<PythonCodeToolConfigField>>(`${this.baseUrl}?tool=${toolId}`)
      .pipe(map((response) => response.results.filter((field) => field.tool === toolId)));
  }

  createField(field: CreateConfigFieldRequest): Observable<PythonCodeToolConfigField> {
    return this.http.post<PythonCodeToolConfigField>(this.baseUrl, field, {
      headers: this.httpHeaders,
    });
  }

  updateField(id: number, field: UpdateConfigFieldRequest): Observable<PythonCodeToolConfigField> {
    return this.http.put<PythonCodeToolConfigField>(`${this.baseUrl}${id}/`, field, {
      headers: this.httpHeaders,
    });
  }

  deleteField(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}${id}/`, {
      headers: this.httpHeaders,
    });
  }
}

