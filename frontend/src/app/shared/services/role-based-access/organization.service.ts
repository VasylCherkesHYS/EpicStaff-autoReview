import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { CreateOrganizationRequest, GetOrganizationDetailsResponse, GetOrganizationsResponse } from '@shared/models';
import { Observable, of } from 'rxjs';

import { ConfigService } from '../../../services/config';

@Injectable({
    providedIn: 'root',
})
export class OrganizationService {
    private readonly configService = inject(ConfigService);
    private readonly http = inject(HttpClient);

    private readonly httpHeaders = new HttpHeaders({
        'Content-Type': 'application/json',
    });

    private get apiUrl(): string {
        return this.configService.apiUrl + 'user/';
    }

    createOrganization(data: CreateOrganizationRequest): Observable<GetOrganizationsResponse> {
        return of({
            id: 2,
            name: data.name,
            initial: 'CS',
            active: true,
            users: data.users.length,
            projects: 0,
            agents: 0,
            tools: 0,
            flows: 0,
            knowledges: 0,
        });
    }

    getOrganizationsByUserId(id: number): Observable<GetOrganizationsResponse[]> {
        void id;
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
    }

    getOrganizationDetailsById(id: number): Observable<GetOrganizationDetailsResponse> {
        void id;
        return of();
    }
}
