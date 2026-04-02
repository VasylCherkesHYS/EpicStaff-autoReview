import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

import { ConfigService } from '../../../services/config';
import { GetOrganizationsResponse } from '../../models';

@Injectable({
    providedIn: 'root',
})
export class OrganizationsService {
    private readonly configService = inject(ConfigService);
    private readonly http = inject(HttpClient);

    private readonly httpHeaders = new HttpHeaders({
        'Content-Type': 'application/json',
    });

    private get apiUrl(): string {
        return this.configService.apiUrl + 'organizations/';
    }

    getOrganizationsByUserId(id: number): Observable<GetOrganizationsResponse[]> {
        // mock data
        return of([
            {
                id: 1,
                name: 'EpicStaff',
                initial: 'E',
                active: true,
                users: 34,
                projects: 34,
                agents: 34,
                tools: 34,
                flows: 34,
                knowledges: 12,
            },
            {
                id: 2,
                name: 'EpicFlow',
                initial: 'E',
                active: false,
                users: 34,
                projects: 34,
                agents: 34,
                tools: 34,
                flows: 34,
                knowledges: 12,
            },
            {
                id: 3,
                name: 'MYM',
                initial: 'M',
                active: false,
                users: 34,
                projects: 34,
                agents: 34,
                tools: 34,
                flows: 34,
                knowledges: 12,
            },
        ]);

        // return this.http.get<GetOrganizationsResponse[]>(`${this.apiUrl}?user_id=${id}`);
    }
}
