import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

import { ConfigService } from '../../../services/config';
import { GetWorkspaceInfoResponse } from '../models/workspace-main.model';

@Injectable({
    providedIn: 'root',
})
export class WorkspaceMainService {
    private readonly configService = inject(ConfigService);
    private readonly http = inject(HttpClient);

    private readonly httpHeaders = new HttpHeaders({
        'Content-Type': 'application/json',
    });

    private get apiUrl(): string {
        return this.configService.apiUrl + 'main/';
    }

    getMainInfo(): Observable<GetWorkspaceInfoResponse> {
        return of({
            organizations: { value: 3, delta: 18, trend: 'increase' },
            users: { value: 247, delta: 18, trend: 'increase' },
            roles: { value: 28, delta: 2, trend: 'increase' },
            flows: { value: 16, delta: 8, trend: 'increase' },
        });
    }
}
