import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    ElementRef,
    inject,
    input,
    model,
    output, ViewChild
} from "@angular/core";
import {ButtonComponent} from "../../../../../../../shared/components/buttons/button/button.component";
import {AppIconComponent} from "../../../../../../../shared/components/app-icon/app-icon.component";
import {FileSizePipe} from "../../../../../../../shared/pipes/file-size.pipe";
import {NgClass} from "@angular/common";
import {CollectionDocument, DisplayedListDocument} from "../../../../../models/document.model";
import {FILE_TYPES} from "../../../../../constants/constants";
import {DocumentsStorageService} from "../../../../../services/documents-storage.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";

@Component({
    selector: "app-files-list",
    templateUrl: "./files-list.component.html",
    styleUrls: ["./files-list.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ButtonComponent,
        AppIconComponent,
        FileSizePipe,
    ]
})
export class FilesListComponent {
    private destroyRef = inject(DestroyRef);
    private readonly documentsStorageService = inject(DocumentsStorageService);
    private readonly allowedTypes = FILE_TYPES;

    documents = model<DisplayedListDocument[]>([]);
    filesUploaded = output<FileList>();
    @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

    // fileValidation = computed(() => {
    //     return this.documents().map(d => {
    //         return {
    //             d,
    //             id: d.document_id,
    //             name: d.file_name,
    //             size: d.file_size,
    //             valid: this.allowedTypes.includes(d.file_type),
    //             extension: d.file_type
    //         };
    //     });
    // });

    hasInvalidFiles = computed(() =>
        this.documents().some(d => !d.isValidType || !d.isValidSize)
    );

    onAddMore() {
        this.fileInput.nativeElement.click();
    }

    onFileSelect(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (input.files) {
            this.filesUploaded.emit(input.files);
        }
    }

    onDelete({document_id, file_name}: DisplayedListDocument): void {
        if (!document_id) {
            this.documents.update(document => {
                return document.filter((d) => d.file_name !== file_name);
            });
            return;
        }

        this.documentsStorageService.deleteDocumentById(document_id).pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: () => {
                this.documents.update(document => {
                    return document.filter((d) => d.document_id !== document_id);
                });
            }
        })
    }

}
