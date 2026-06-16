import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { SKIP_NOT_FOUND_REDIRECT } from '../../../core/interceptors/not-found.interceptor';
import { ConfigService } from '../../../services/config/config.service';
import {
    CopyDocumentsRequest,
    CopyDocumentsResponse,
    DeleteDocumentResponse,
    UploadDocumentResponse,
} from '../models/document.model';

@Injectable({
    providedIn: 'root',
})
export class DocumentsApiService {
    private http = inject(HttpClient);
    private configService = inject(ConfigService);

    private readonly httpHeaders = new HttpHeaders({
        'Content-Type': 'application/json',
    });

    private get apiUrl(): string {
        return `${this.configService.apiUrl}documents`;
    }

    uploadDocuments(collectionId: number, files: File[]): Observable<UploadDocumentResponse> {
        const formData = new FormData();

        files.forEach((file) => {
            formData.append('files', file);
        });

        return this.http.post<UploadDocumentResponse>(
            `${this.apiUrl}/source-collection/${collectionId}/upload/`,
            formData,
            { context: new HttpContext().set(SKIP_NOT_FOUND_REDIRECT, true) }
        );
    }

    downloadDocuments(ids: number[]): Observable<Blob> {
        const params = new HttpParams().set('document_ids', ids.join(','));
        return this.http.get(`${this.apiUrl}/download/`, {
            responseType: 'blob',
            params,
            context: new HttpContext().set(SKIP_NOT_FOUND_REDIRECT, true),
        });
    }

    previewDocumentBlob(id: number): Observable<Blob> {
        return this.http.get(`${this.apiUrl}/${id}/preview/`, {
            responseType: 'blob',
            context: new HttpContext().set(SKIP_NOT_FOUND_REDIRECT, true),
        });
    }

    copyDocuments(dto: CopyDocumentsRequest): Observable<CopyDocumentsResponse> {
        return this.http.post<CopyDocumentsResponse>(`${this.apiUrl}/copy/`, dto, {
            context: new HttpContext().set(SKIP_NOT_FOUND_REDIRECT, true),
        });
    }

    deleteDocumentById(id: number): Observable<DeleteDocumentResponse> {
        return this.http.delete<DeleteDocumentResponse>(`${this.apiUrl}/${id}/`, {
            context: new HttpContext().set(SKIP_NOT_FOUND_REDIRECT, true),
        });
    }
}
