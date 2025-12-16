import {ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, OnInit, signal} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {SearchComponent} from "../../../../shared/components/search/search.component";
import {SelectComponent, SelectItem} from "../../../../shared/components/select/select.component";
import {ConfigurationTableComponent} from "./configuration-table/configuration-table.component";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {CreateCollectionDtoResponse} from "../../models/collection.model";
import {NaiveRagService} from "../../services/naive-rag.service";
import {NaiveRagDocumentConfig} from "../../models/rag.model";
import {switchMap} from "rxjs/operators";
import {ToastService} from "../../../../services/notifications/toast.service";

@Component({
    selector: 'app-rag-configuration',
    templateUrl: './rag-configuration.component.html',
    styleUrls: ['./rag-configuration.component.scss'],
    imports: [
        FormsModule,
        SearchComponent,
        SelectComponent,
        ConfigurationTableComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class RagConfigurationComponent implements OnInit {
    searchTerm = signal<string>('');
    collection = input.required<CreateCollectionDtoResponse>();
    naiveRagId = input.required<number>();

    documents = signal<NaiveRagDocumentConfig[]>([]);
    filteredDocuments = computed(() => {
        const term = this.searchTerm();

        return this.documents().filter(d => {
            return d.file_name.toLowerCase().includes(term.toLowerCase());
        });
    });

    private naiveRagService = inject(NaiveRagService);
    private destroyRef = inject(DestroyRef);
    private toastService = inject(ToastService);

    selectItems: SelectItem[] = [
        {
            name: 'Bulk configuration',
            value: 'bulk'
        },
        {
            name: 'Remove file from RAG',
            value: 'remove'
        },
    ];

    ngOnInit() {
        const id = this.naiveRagId();

        this.naiveRagService.initDocumentConfigs(id).pipe(
            switchMap(() => this.naiveRagService.getDocumentConfigs(id)),
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: ({configs}) => {
                this.documents.set(configs)
            },
            error: (e) => {
                this.toastService.error('Failed to fetch documents');
                console.log(e)
            }
        });
    }
}
