import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ConfigService } from '../../../services/config/config.service';
import { Observable } from 'rxjs';
import { ProcessDocumentChunkingRequest } from '../models/embedding-result.model';

@Injectable({
    providedIn: 'root'
})
export class SourceEmbeddingService {
    constructor(private http: HttpClient, private configService: ConfigService) { }

    private get apiUrlDocumentChunking(): string {
        return `${this.configService.apiUrl}process-document-chunking/`
    }

    private get apiUrlCollectionEmbedding(): string {
        return `${this.configService.apiUrl}process-collection-embedding/`
    }

    createDocumentChunking(documentId: number): Observable<ProcessDocumentChunkingRequest> {
        const data = { "document_id": documentId };

        return this.http.post<ProcessDocumentChunkingRequest>(this.apiUrlDocumentChunking, data);
    }

}
