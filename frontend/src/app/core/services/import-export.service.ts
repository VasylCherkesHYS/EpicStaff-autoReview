import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ConfigService } from '../../services/config/config.service';

export type ExportFormat = 'json' | 'csv';

export interface PartialExportRequest {
    start_node_list: number[];
    crew_node_list: number[];
    python_node_list: number[];
    audio_transcription_node_list: number[];
    file_extractor_node_list: number[];
    end_node_list: number[];
    subgraph_node_list: number[];
    webhook_trigger_node_list: number[];
    telegram_trigger_node_list: number[];
    decision_table_node_list: number[];
    classification_decision_table_node_list: number[];
    graph_note_list: number[];
    code_agent_node_list: number[];
    edge_list: number[];
}

@Injectable({
    providedIn: 'root',
})
export class ImportExportService {
    constructor(
        private http: HttpClient,
        private configService: ConfigService
    ) {}

    private get apiUrl(): string {
        return this.configService.apiUrl + 'graphs/';
    }

    private get sessionsApiUrl(): string {
        return this.configService.apiUrl + 'sessions/';
    }

    partialExport(graphId: number, body: PartialExportRequest): Observable<Blob> {
        return this.http.post(`${this.apiUrl}${graphId}/partial-export/`, body, {
            responseType: 'blob',
        });
    }

    partialImport(graphId: number, file: File): Observable<unknown> {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post(`${this.apiUrl}${graphId}/partial-import/`, formData);
    }

    importFlow(file: File, preserveUuids: boolean = false): Observable<Record<string, unknown>> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('preserve_uuids', String(preserveUuids));

        return this.http.post<Record<string, unknown>>(`${this.apiUrl}import/`, formData);
    }

    exportFlow(graphId: string): Observable<Blob> {
        return this.http.get(`${this.apiUrl}${graphId}/export/`, {
            responseType: 'blob',
        });
    }

    bulkExportFlow(ids: number[]): Observable<Blob> {
        return this.http.post(
            `${this.apiUrl}bulk-export/`,
            { ids },
            {
                responseType: 'blob',
            }
        );
    }

    exportSession(id: number, format: ExportFormat): Observable<Blob> {
        return this.http.get(`${this.sessionsApiUrl}${id}/export/?export_format=${format}`, {
            responseType: 'blob',
        });
    }

    bulkExportSessions(ids: number[], format: ExportFormat): Observable<Blob> {
        return this.http.post(
            `${this.sessionsApiUrl}bulk-export/?export_format=${format}`,
            { ids },
            {
                responseType: 'blob',
            }
        );
    }

    exportAll(filters: { graph?: number | null; status?: string[] }, format: ExportFormat = 'json'): Observable<Blob> {
        const body: Record<string, unknown> = {};
        if (filters.graph != null) body['graph_id'] = filters.graph;
        if (filters.status != null && filters.status.length > 0) body['status'] = filters.status;
        return this.http.post<Blob>(`${this.sessionsApiUrl}export_all/?export_format=${format}`, body, {
            responseType: 'blob' as 'json',
        });
    }
}
