import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CreatePythonNodeRequest } from '../models/python-node.model';
import { ConfigService } from '../../../../../services/config/config.service';
import { PaginatedResponse } from '../../../../../shared/models/paginated-response';
import { CreateWebhookTriggerNodeRequest, GetWebhookTriggerNodeRequest } from '../models/webhook-trigger';
export interface WebhookTrigger {
  id: number;
}

export type WebhookTriggersArray = WebhookTrigger[];
@Injectable({
  providedIn: 'root',
})
export class WebhookTriggerNodeService {
  private headers = new HttpHeaders({
    'Content-Type': 'application/json',
  });

  constructor(private http: HttpClient, private configService: ConfigService) { }

  private get apiUrlTriggers(): string {
    return this.configService.apiUrl + 'webhook-triggers/';
  }

  private get apiUrlNode(): string {
    return this.configService.apiUrl + 'webhook-trigger-nodes/';
  }

  getWebhookTriggersRequest(): Observable<PaginatedResponse<WebhookTrigger>> {
    return this.http.get<PaginatedResponse<WebhookTrigger>>(this.apiUrlTriggers)
  }

  getWebhookTriggerNodeRequest(): Observable<PaginatedResponse<GetWebhookTriggerNodeRequest>> {
    return this.http.get<PaginatedResponse<GetWebhookTriggerNodeRequest>>(this.apiUrlTriggers)
  }

  createWebhookTriggerNode(request: CreateWebhookTriggerNodeRequest): Observable<any> {
    return this.http.post<any>(this.apiUrlNode, request, {
      headers: this.headers,
    });
  }

  deleteWebhookTriggerNode(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrlNode}${id}/`, {
      headers: this.headers,
    });
  }

  getTunnelUrl(): Observable<{ status: string; tunnel_url?: string | null }> {
    return this.http.get<{ status: string; tunnel_url?: string | null }>('http://localhost:8009/api/tunnel-url');
  }
}
