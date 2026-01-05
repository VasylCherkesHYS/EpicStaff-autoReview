import {NaiveRagDocumentConfig} from "../../../models/rag.model";

export interface TableDocument extends NaiveRagDocumentConfig {
    checked: boolean;
}

export type DocFieldChange = {
    documentId: number;
    documentName: string;
    field: keyof TableDocument;
    value: any;
};

export type SortState = {
    column: 'chunk_size' | 'chunk_overlap';
    dir: 'asc' | 'desc';
} | null;

export type FieldUpdateStatus = 'idle' | 'pending' | 'success' | 'error';

export type DocumentUpdateStatus = {
    [K in keyof TableDocument]: FieldUpdateStatus;
};
