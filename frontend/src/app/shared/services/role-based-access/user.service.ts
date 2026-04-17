import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

import { ConfigService } from '../../../services/config';
import { GetUserResponse, GetUsersResponse, UserOrganizationRole } from '../../models';

@Injectable({
    providedIn: 'root',
})
export class UserService {
    private readonly configService = inject(ConfigService);
    private readonly http = inject(HttpClient);

    private readonly httpHeaders = new HttpHeaders({
        'Content-Type': 'application/json',
    });

    private get apiUrl(): string {
        return this.configService.apiUrl + 'user/';
    }

    getCurrentUser(): Observable<GetUserResponse> {
        return of({
            id: 1,
            name: 'Ivan Bohun',
            role: UserOrganizationRole.SUPER_ADMIN,
            initials: 'IB',
            organizations: [
                {
                    id: 1,
                    name: 'EpicStaff',
                    initial: 'E',
                    active: true,
                },
                {
                    id: 2,
                    name: 'EpicFlow',
                    initial: 'E',
                    active: false,
                },
                {
                    id: 3,
                    name: 'MYM',
                    initial: 'M',
                    active: false,
                },
            ],
        });
    }

    getUsers(): Observable<GetUsersResponse[]> {
        return of([
            {
                id: 1,
                initials: 'IB',
                name: 'Ivan Bohun',
                email: 'ivan_bohun@gmail.com',
                roles: [UserOrganizationRole.SUPER_ADMIN],
            },
            {
                id: 2,
                initials: 'IV',
                name: 'Ivan Vyhovskyi',
                email: 'ivan_vyhovskyi@gmail.com',
                roles: [UserOrganizationRole.SUPER_ADMIN],
            },
            {
                id: 3,
                initials: 'BK',
                name: 'Bohdan Khmelnytsky',
                email: 'bohdan_khmelnytsky@gmail.com',
                roles: [UserOrganizationRole.SUPER_ADMIN],
            },
        ]);
    }
}
