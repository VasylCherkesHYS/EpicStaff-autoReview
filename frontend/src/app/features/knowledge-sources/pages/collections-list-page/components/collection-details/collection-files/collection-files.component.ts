import {ChangeDetectionStrategy, Component, signal} from "@angular/core";
import {AppIconComponent} from "../../../../../../../shared/components/app-icon/app-icon.component";
import {FileSizePipe} from "../../../../../../../shared/pipes/file-size.pipe";
import {
    ListActionsComponent
} from "../../../../../../../shared/components/list/list-actions/list-actions.component";
import {ListComponent} from "../../../../../../../shared/components/list/list.component";
import {ListRowComponent} from "../../../../../../../shared/components/list/list-row/list-row.component";

@Component({
    selector: 'app-collection-details-files',
    templateUrl: './collection-files.component.html',
    styleUrls: ['./collection-files.component.scss'],
    imports: [
        AppIconComponent,
        FileSizePipe,
        ListActionsComponent,
        ListComponent,
        ListRowComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionFilesComponent{
    documents = signal<any[]>([
        {
            document_id: 1,
            file_name: 'pdf_1.pdf',
            file_size: 1500,
            file_type: 'pdf',
            source_collection: 0,
            isValidType: true,
            isValidSize: true,
        },
        {
            document_id: 2,
            file_name: 'pdf_22.pdf',
            file_size: 1500,
            file_type: 'pdf',
            source_collection: 0,
            isValidType: true,
            isValidSize: true,
        },
        {
            document_id: 3,
            file_name: 'pdf_3333333333333333333333333333333333333333333333333333.pdf',
            file_size: 1500,
            file_type: 'pdf',
            source_collection: 0,
            isValidType: true,
            isValidSize: true,
        }
    ]);

    onDocumentDelete(d: any): void {
        console.log(d);
    }

}
