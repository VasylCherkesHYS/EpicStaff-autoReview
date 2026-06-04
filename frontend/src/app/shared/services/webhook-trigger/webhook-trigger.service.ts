import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { ConfigService } from '../../../services/config';
import { WebhookTriggerModel } from '../../../visual-programming/core/models/webhook-trigger.model';

interface ApiListResponse<T> {
    results: T[];
}

@Injectable({ providedIn: 'root' })
export class WebhookTriggerService {
    private http = inject(HttpClient);
    private configService = inject(ConfigService);
    private headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    private get apiUrl(): string {
        return this.configService.apiUrl + 'webhook-triggers/';
    }

    list(): Observable<WebhookTriggerModel[]> {
        return this.http
            .get<ApiListResponse<WebhookTriggerModel>>(this.apiUrl, { headers: this.headers })
            .pipe(map((r) => r.results));
    }

    getById(id: number): Observable<WebhookTriggerModel> {
        return this.http.get<WebhookTriggerModel>(`${this.apiUrl}${id}/`, { headers: this.headers });
    }

    create(body: WebhookTriggerModel): Observable<WebhookTriggerModel> {
        return this.http.post<WebhookTriggerModel>(this.apiUrl, body, { headers: this.headers });
    }

    update(id: number, body: WebhookTriggerModel): Observable<WebhookTriggerModel> {
        return this.http.patch<WebhookTriggerModel>(`${this.apiUrl}${id}/`, body, { headers: this.headers });
    }

    delete(id: number): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}${id}/`, { headers: this.headers });
    }
}
