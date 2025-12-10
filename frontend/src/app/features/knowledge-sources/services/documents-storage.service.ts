import {inject, Injectable, signal} from "@angular/core";
import {CollectionDocument, UploadDocumentResponse} from "../models/document.model";
import {DocumentsApiService} from "./documents-api.service";
import {tap} from "rxjs/operators";

@Injectable({
    providedIn: 'root',
})
export class DocumentsStorageService {
    private documentsSignal = signal<CollectionDocument[]>([]);
    private documentsLoaded = signal<boolean>(false);
    public readonly documents = this.documentsSignal.asReadonly();
    public readonly isDocumentsLoaded = this.documentsLoaded.asReadonly();

    private readonly documentsApiService = inject(DocumentsApiService);

    uploadDocuments(collectionId: number, files: File[]) {
        return this.documentsApiService.uploadDocuments(collectionId, files).pipe(
            tap((resp: UploadDocumentResponse) => {
                const { documents } = resp;
                this.addDocumentsToCache(documents);
            })
        );
    }

    deleteDocumentById(id: number) {
        return this.documentsApiService.deleteDocumentById(id).pipe(
            tap(() => this.deleteDocumentFromCache(id)),
        )
    }

    private addDocumentsToCache(documents: CollectionDocument[]) {
        this.documentsSignal.update(currentDocs => {
            const existingIds = new Set(currentDocs.map(d => d.document_id));

            const newDocs = documents.filter(d => !existingIds.has(d.document_id));

            return [...currentDocs, ...newDocs];
        });
    }

    private deleteDocumentFromCache(id: number) {
        const currentDocuments = this.documentsSignal();
        const updatedDocuments = currentDocuments.filter(
            (d) => d.document_id !== id
        );
        this.documentsSignal.set(updatedDocuments);
    }
}
