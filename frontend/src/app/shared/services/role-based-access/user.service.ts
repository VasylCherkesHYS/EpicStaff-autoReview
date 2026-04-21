import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

import { ConfigService } from '../../../services/config';
import { CreateUserRequest, GetUserResponse, UserRole } from '../../models';

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

    createUser(data: CreateUserRequest): Observable<GetUserResponse> {
        return of({
            id: 2,
            name: data.name,
            email: data.email,
            organizations: [
                {
                    id: 1,
                    name: 'EpicStaff',
                    active: true,
                    roles: [UserRole.SUPER_ADMIN],
                },
                {
                    id: 2,
                    name: 'EpicFlow',
                    active: false,
                    roles: [UserRole.SUPER_ADMIN],
                },
                {
                    id: 3,
                    name: 'MYM',
                    active: false,
                    roles: [UserRole.SUPER_ADMIN],
                },
            ],
        });
    }

    getCurrentUser(): Observable<GetUserResponse> {
        return of({
            id: 1,
            name: 'Ivan Bohun',
            email: 'ivan.bohun@mail.com',
            organizations: [
                {
                    id: 1,
                    name: 'EpicStaff',
                    active: true,
                    roles: [UserRole.SUPER_ADMIN],
                },
                {
                    id: 2,
                    name: 'EpicFlow',
                    active: false,
                    roles: [UserRole.SUPER_ADMIN],
                },
                {
                    id: 3,
                    name: 'MYM',
                    active: false,
                    roles: [UserRole.SUPER_ADMIN],
                },
            ],
        });
    }

    getUsers(): Observable<GetUserResponse[]> {
        return of([
            {
                id: 1,
                name: 'Ivan Bohun',
                email: 'ivan.bohun@mail.com',
                organizations: [
                    {
                        id: 1,
                        name: 'EpicStaff',
                        active: true,
                        roles: [UserRole.SUPER_ADMIN],
                    },
                    {
                        id: 2,
                        name: 'EpicFlow',
                        active: false,
                        roles: [UserRole.SUPER_ADMIN],
                    },
                    {
                        id: 3,
                        name: 'MYM',
                        active: false,
                        roles: [UserRole.SUPER_ADMIN],
                    },
                ],
            },
            {
                id: 1,
                name: 'Ivan Bohun',
                email: 'ivan.bohun@mail.com',
                organizations: [
                    {
                        id: 1,
                        name: 'EpicStaff',
                        active: true,
                        roles: [UserRole.SUPER_ADMIN],
                    },
                    {
                        id: 2,
                        name: 'EpicFlow',
                        active: false,
                        roles: [UserRole.SUPER_ADMIN],
                    },
                    {
                        id: 3,
                        name: 'MYM',
                        active: false,
                        roles: [UserRole.SUPER_ADMIN],
                    },
                ],
            },
        ]);
    }
}
