import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

import { ConfigService } from '../../../services/config';
import { GetUserResponse, UserRole } from '../../models';

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
        // mock data
        return of({ id: 1, name: 'Ivan Bohun', role: UserRole.SUPER_ADMIN, initials: 'IB' });

        // return this.http.get<GetUserResponse>(this.apiUrl + 'me/');
    }
}
