import {ChangeDetectionStrategy, Component, inject, input, OnInit, model, DestroyRef} from "@angular/core";
import {FormControl, ReactiveFormsModule, Validators} from "@angular/forms";
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {UpperCasePipe} from "@angular/common";
import {uniqueCollectionNameValidator} from "../../../../../../shared/form-validators/unique-collection-name.validator";
import {CreateCollectionDtoResponse} from "../../../../models/collection.model";
import {MATERIAL_FORMS} from "../../../../../../shared/material-forms";
import {FileUploaderComponent} from "../../file-uploader/file-uploader.component";
import {FilesListComponent} from "./files-list/files-list.component";
import {FilePreviewComponent} from "./file-preview/file-preview.component";
import {CollectionsStorageService} from "../../../../services/collections-storage.service";
import {DocumentsStorageService} from "../../../../services/documents-storage.service";
import {CollectionDocument, DisplayedListDocument, FileType} from "../../../../models/document.model";
import {FILE_TYPES, MAX_DOCUMENT_SIZE} from "../../../../constants/constants";

@Component({
    selector: "app-step-upload-files",
    templateUrl: "./step-upload-files.component.html",
    styleUrls: ["./step-upload-files.component.scss"],
    imports: [
        MATERIAL_FORMS,
        ReactiveFormsModule,
        FileUploaderComponent,
        FilesListComponent,
        FilePreviewComponent,
        UpperCasePipe
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class StepUploadFilesComponent implements OnInit {
    private destroyRef = inject(DestroyRef);
    private collectionsStorageService = inject(CollectionsStorageService);
    private documentsStorageService = inject(DocumentsStorageService);
    protected readonly allowedTypes = FILE_TYPES;

    collectionName: FormControl = new FormControl("", Validators.required);
    collection = input.required<CreateCollectionDtoResponse>();
    documents = model<DisplayedListDocument[]>([]);

    ngOnInit() {
        this.collectionName.setValue(this.collection().collection_name);

        this.collectionName?.valueChanges.pipe(
            debounceTime(400),
            distinctUntilChanged(),
            switchMap((collection_name: string) => {
                const id = this.collection().collection_id;
                const body = { collection_name }

                return this.collectionsStorageService.updateCollectionById(id, body)
            }),
            takeUntilDestroyed(this.destroyRef)
        ).subscribe();
    }

    onFilesUpload(files: FileList) {
        const collectionId = this.collection().collection_id;
        // 1: filter duplicates by file name
        const filteredByName = this.filterDuplicatesByName(files);
        // 2: transform File[] to DisplayedListDocument[]
        const transformed = this.transformFilesToDocuments(filteredByName);
        // 3: display both valid and invalid files
        this.documents.update((d) => [...d, ...transformed]);
        console.log(this.documents(), 'files to dosplay');
        // 4: filter valid files for upload to backend
        const toUpload = this.filterFilesToUpload(filteredByName);
        console.log(toUpload, 'toupload')
        if (!toUpload.length) {return;}
        // 5: upload documents to backend
        this.documentsStorageService.uploadDocuments(collectionId, toUpload)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(({documents}) => {
                // 6: update displayed documents
                this.updateDisplayedDocumentsAfterUpload(documents);
                console.log(documents, 'on upload')
            });
    }

    private updateDisplayedDocumentsAfterUpload(uploadedDocs: CollectionDocument[]) {
        this.documents.update((displayedDocs) => {
            return displayedDocs.map(doc => {
                const updated = uploadedDocs.find(
                    d => d.file_name === doc.file_name &&
                        d.source_collection === doc.source_collection
                );

                if (!updated) return doc;

                return {
                    ...doc,
                    document_id: updated.document_id,
                    isValidType: true,
                    isValidSize: true
                };
            });
        });
    }

    private filterFilesToUpload(files: File[]): File[] {
        return files.filter((file) => {
            const type = file.type.split('/').pop() as FileType;
            return this.allowedTypes.includes(type) && file.size < MAX_DOCUMENT_SIZE;
        })
    }

    private transformFilesToDocuments(files: File[]): DisplayedListDocument[] {
        const source_collection = this.collection().collection_id;

        return files.map((file: File) => {
            const type = file.type.split('/').pop() as FileType;
            const isValidType = this.allowedTypes.includes(type);
            const isValidSize = file.size < MAX_DOCUMENT_SIZE;

            return {
                file_name: file.name,
                file_size: file.size,
                file_type: type,
                source_collection,
                isValidType,
                isValidSize
            }
        });
    }

    private filterDuplicatesByName(files: FileList) {
        const arr: File[] = [];
        for (const file of Array.from(files)) {
            // Skip duplicates by name
            const hasDuplicates = arr.some(f => f.name === file.name);
            // Check if file was uploaded before
            const isAlreadyUploaded = this.documents().some(d => d.file_name === file.name);
            console.log(hasDuplicates, isAlreadyUploaded)
            if (hasDuplicates || isAlreadyUploaded) {
                continue;
            }

            arr.push(file);
        }
        return arr;
    }
}
