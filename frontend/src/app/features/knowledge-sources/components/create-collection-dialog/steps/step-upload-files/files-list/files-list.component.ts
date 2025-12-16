import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    ElementRef,
    inject,
    model,
    output, signal, ViewChild
} from "@angular/core";
import {ButtonComponent} from "../../../../../../../shared/components/buttons/button/button.component";
import {AppIconComponent} from "../../../../../../../shared/components/app-icon/app-icon.component";
import {FileSizePipe} from "../../../../../../../shared/pipes/file-size.pipe";
import { DisplayedListDocument} from "../../../../../models/document.model";
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

    @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
    documents = model<DisplayedListDocument[]>([]);
    filesUploaded = output<FileList>();
    isDragging = signal<boolean>(false);

    hasInvalidFiles = computed(() =>
        this.documents().some(d => !d.isValidType || !d.isValidSize)
    );

    onAddMore(): void {
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
        ).subscribe((res) => {
            if (!res) return;

            this.documents.update(document => {
                return document.filter((d) => d.document_id !== document_id);
            });
        })
    }

    onDragOver(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.isDragging.set(true);
    }

    onDragLeave(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();

        const target = event.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        const { clientX, clientY } = event;

        if (
            clientX <= rect.left ||
            clientX >= rect.right ||
            clientY <= rect.top ||
            clientY >= rect.bottom
        ) {
            this.isDragging.set(false);
        }
    }

    onDrop(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.isDragging.set(false);

        if (event.dataTransfer?.files.length) {
            this.filesUploaded.emit(event.dataTransfer.files);
        }
    }
}
