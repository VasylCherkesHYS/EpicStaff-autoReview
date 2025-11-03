import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ConfigService } from '../../../services/config/config.service';
import { Observable } from 'rxjs';
import { GetProcessingEmbeddingResponse, ProcessCollectionEmbeddingRequest, ProcessDocumentChunkingRequest } from '../models/embedding-result.model';

@Injectable({
    providedIn: 'root'
})
export class SourceEmbeddingService {
    constructor(private http: HttpClient, private configService: ConfigService) { }

    private get apiUrlCreatingDocumentChunking(): string {
        return `${this.configService.apiUrl}process-document-chunking/`
    }

    private get apiUrlGettingDocumentChunking(): string {
        return `${this.configService.apiUrl}document-chunks/`
    }

    private get apiUrlProcessingEmbedding(): string {
        return `${this.configService.apiUrl}process-collection-embedding/`
    }

    private get apiUrlGetEmbeddingCollection(): string {
        return `${this.configService.apiUrl}collection_statuses/`
    }

    createDocumentChunking(documentId: number): Observable<ProcessDocumentChunkingRequest> {
        const data = { "document_id": documentId };

        return this.http.post<ProcessDocumentChunkingRequest>(this.apiUrlCreatingDocumentChunking, data);
    }

    getResultDocumentChunking(documentId: number) {
        return this.http.get<ProcessDocumentChunkingRequest>(`${this.apiUrlGettingDocumentChunking}?document_id=${documentId}`);

    }

    createProcessingEmbedding(collection_id: number) {
        const data = {
            "collection_id": collection_id
        }

        return this.http.post<ProcessCollectionEmbeddingRequest>(this.apiUrlProcessingEmbedding, data)
    }

    getProcessingEmbedding(collection_id: number): Observable<GetProcessingEmbeddingResponse> {
        const data = {
            "collection_id": collection_id
        }

        return this.http.get<GetProcessingEmbeddingResponse>(`${this.apiUrlGetEmbeddingCollection}?collection_id=${collection_id}`)
    }


}
