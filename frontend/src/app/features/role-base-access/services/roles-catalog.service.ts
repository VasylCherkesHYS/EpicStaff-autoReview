import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { CatalogResponse } from '@shared/models';
import { Observable, of, tap } from 'rxjs';

import { ConfigService } from '../../../services/config';

@Injectable({
    providedIn: 'root',
})
export class RolesCatalogService {
    private readonly http = inject(HttpClient);
    private readonly configService = inject(ConfigService);

    private get apiUrl(): string {
        return `${this.configService.apiUrl}permissions/catalog/`;
    }

    private readonly _catalog = signal<CatalogResponse | null>(null);
    readonly catalog = this._catalog.asReadonly();

    loadCatalog(): Observable<CatalogResponse> {
        const cached = this._catalog();
        if (cached) return of(cached);

        return this.http.get<CatalogResponse>(this.apiUrl).pipe(tap((catalog) => this._catalog.set(catalog)));
    }
}
