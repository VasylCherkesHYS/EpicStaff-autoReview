import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { SKIP_NOT_FOUND_REDIRECT } from '../../../core/interceptors/not-found.interceptor';
import { ConfigService } from '../../../services/config';
import { StartIndexingDtoRequest, StartIndexingDtoResponse } from '../models/base-rag.model';
import {
    CollectionGraphRag,
    CreateGraphRagForCollectionResponse,
    CreateGraphRagIndexConfigRequest,
} from '../models/graph-rag.model';

@Injectable({
    providedIn: 'root',
})
export class GraphRagService {
    private http = inject(HttpClient);
    private configService = inject(ConfigService);

    private readonly httpHeaders = new HttpHeaders({
        'Content-Type': 'application/json',
    });

    private get apiUrl(): string {
        return `${this.configService.apiUrl}graph-rag/`;
    }

    createRagForCollection(
        collectionId: number,
        embedderId: number,
        llmId: number
    ): Observable<CreateGraphRagForCollectionResponse> {
        const body = { embedder_id: embedderId, llm_id: llmId };

        return this.http.post<CreateGraphRagForCollectionResponse>(
            `${this.apiUrl}collections/${collectionId}/graph-rag/`,
            body,
            { context: new HttpContext().set(SKIP_NOT_FOUND_REDIRECT, true) }
        );
    }

    getRagById(ragId: number): Observable<CollectionGraphRag> {
        return this.http.get<CollectionGraphRag>(`${this.apiUrl}${ragId}/`);
    }

    updateRagIndexConfigs(
        ragId: number,
        dto: CreateGraphRagIndexConfigRequest
    ): Observable<CreateGraphRagIndexConfigRequest> {
        return this.http.put<CreateGraphRagIndexConfigRequest>(`${this.apiUrl}${ragId}/index-config/`, dto, {
            context: new HttpContext().set(SKIP_NOT_FOUND_REDIRECT, true),
        });
    }

    startIndexing(dto: StartIndexingDtoRequest): Observable<StartIndexingDtoResponse> {
        return this.http.post<StartIndexingDtoResponse>(`${this.configService.apiUrl}process-rag-indexing/`, dto, {
            context: new HttpContext().set(SKIP_NOT_FOUND_REDIRECT, true),
        });
    }

    deleteFileById(ragId: number, fileId: number): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}${ragId}/documents/${fileId}/`, {
            context: new HttpContext().set(SKIP_NOT_FOUND_REDIRECT, true),
        });
    }

    reIncludeFiles(ragId: number): Observable<void> {
        return this.http.post<void>(
            `${this.apiUrl}${ragId}/documents/initialize/`,
            {},
            { context: new HttpContext().set(SKIP_NOT_FOUND_REDIRECT, true) }
        );
    }
}
