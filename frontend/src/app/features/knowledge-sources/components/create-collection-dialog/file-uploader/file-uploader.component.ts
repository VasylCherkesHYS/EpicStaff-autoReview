import {ChangeDetectionStrategy, Component, input, signal, output} from "@angular/core";

@Component({
    selector: 'app-file-uploader',
    templateUrl: "./file-uploader.component.html",
    styleUrls: ["./file-uploader.component.scss"],

    changeDetection: ChangeDetectionStrategy.OnPush
})
export class FileUploaderComponent {
    isDragging = signal<boolean>(false);

    filesUploaded = output<FileList>();

    onDragOver(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.isDragging.set(true);
    }

    onDragLeave(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.isDragging.set(false);
    }

    onDrop(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.isDragging.set(false);
    }

    onFileSelect(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (input.files) {
            this.filesUploaded.emit(input.files);
        }
    }
}
