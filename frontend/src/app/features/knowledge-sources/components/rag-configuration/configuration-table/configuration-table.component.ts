import {
    ChangeDetectionStrategy,
    Component,
    computed, DestroyRef,
    inject,
    input,
    linkedSignal, model,
    OnInit,
    Signal,
    signal
} from "@angular/core";
import {SelectComponent} from "../../../../../shared/components/select/select.component";
import {AppIconComponent} from "../../../../../shared/components/app-icon/app-icon.component";
import {ButtonComponent} from "../../../../../shared/components/buttons/button/button.component";
import {InputComponent} from "../../../../../shared/components/app-input/input.component";
import {CheckboxComponent} from "../../../../../shared/components/checkbox/checkbox.component";
import {
    MultiSelectComponent,
    MultiSelectItem
} from "../../../../../shared/components/multi-select/multi-select.component";
import {CHUNK_STRATEGIES, FILE_TYPES} from "../../../constants/constants";
import {NaiveRagDocumentConfig} from "../../../models/rag.model";
import {NaiveRagService} from "../../../services/naive-rag.service";
import {EMPTY, groupBy, mergeMap, Subject} from "rxjs";
import {catchError, debounceTime, switchMap, tap} from "rxjs/operators";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {ToastService} from "../../../../../services/notifications/toast.service";
import {HttpErrorResponse} from "@angular/common/http";

interface TableDocument extends NaiveRagDocumentConfig {
    selected: boolean;
}

type DocFieldChange = {
    documentId: number;
    documentName: string;
    field: 'chunk_strategy' | 'chunk_size' | 'chunk_overlap';
    value: any;
};

type SortState = {
    column: 'chunk_size' | 'chunk_overlap';
    dir: 'asc' | 'desc';
} | null;

@Component({
    selector: 'app-configuration-table',
    templateUrl: './configuration-table.component.html',
    styleUrls: ['./configuration-table.component.scss'],
    imports: [
        SelectComponent,
        AppIconComponent,
        ButtonComponent,
        InputComponent,
        CheckboxComponent,
        MultiSelectComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfigurationTableComponent implements OnInit {
    fileTypeSelectItems: MultiSelectItem[] = FILE_TYPES.map(t => ({name: t, value: t}));
    chunkStrategySelectItems: MultiSelectItem[] = CHUNK_STRATEGIES.map(t => ({name: t, value: t.toLowerCase()}));

    private naiveRagService = inject(NaiveRagService);
    private destroyRef = inject(DestroyRef);
    private toastService = inject(ToastService);
    private docFieldChange$ = new Subject<DocFieldChange>();

    ragId = input.required<number>();
    bulkEditing = input<boolean>(false);
    documents = model<NaiveRagDocumentConfig[]>([]);

    allSelected = computed(() => this.filteredAndSorted().every(r => r.selected));
    indeterminate = computed(() => {
        const selectedCount = this.filteredAndSorted().filter(r => r.selected).length;
        return selectedCount > 0 && !this.allSelected();
    });

    filesFilter = signal<any[]>([]);
    chunkStrategyFilter = signal<any[]>([]);
    sort = signal<SortState>(null);

    filteredAndSorted = linkedSignal<TableDocument[]>(() => {
        let data = this.documents().map(d => ({...d, selected: false}));

        // -------- FILTERS --------
        if (this.filesFilter().length) {
            data = data.filter(d => this.filesFilter().includes(d.file_name));
        }

        if (this.chunkStrategyFilter().length) {
            data = data.filter(d =>
                this.chunkStrategyFilter().includes(d.chunk_strategy)
            );
        }

        // -------- SORT --------
        const sort = this.sort();
        if (!sort) return data;

        const dir = sort.dir === 'asc' ? 1 : -1;
        const col = sort.column;

        console.log(this.sort())

        return [...data].sort((a, b) => (a[col] - b[col]) * dir);
    });

    ngOnInit() {
        this.docFieldChange$
            .pipe(
                groupBy((c: DocFieldChange) => `${c.documentId}:${c.field}`),

                mergeMap(group$ =>
                    group$.pipe(
                        debounceTime(300),

                        switchMap(({ documentId, documentName, field, value }) => {
                            if (!value === null) {
                                return EMPTY;
                            }

                            return this.naiveRagService.updateDocumentConfig(
                                this.ragId(),
                                documentId,
                                { [field]: value }
                            ).pipe(
                                tap(({config}) => {
                                    this.toastService.success('Document updated');
                                    this.documents.update(items => items.map(i => {
                                        return i.document_id === config.document_id ? { ...config } : i
                                    }))
                                }),
                                catchError((e: HttpErrorResponse) => {
                                    this.hangleUpdateError(e, field, documentName);
                                    return EMPTY;
                                })
                            );
                        })
                    )
                ),

                takeUntilDestroyed(this.destroyRef)
            ).subscribe();
    }

    toggleAll() {
        const all = this.allSelected();
        this.filteredAndSorted.update(items => items.map(i => ({ ...i, selected: !all })));
    }

    toggleDocument(item: TableDocument) {
        this.filteredAndSorted.update(items => items.map(i => {
            return i === item ? { ...i, selected: !i.selected } : i
        }));
    }

    sortBy(column: 'chunk_size' | 'chunk_overlap') {
        const current = this.sort();

        if (!current || current.column !== column) {
            this.sort.set({ column, dir: 'desc' });
            return;
        }

        this.sort.set({
            column,
            dir: current.dir === 'desc' ? 'asc' : 'desc'
        });
    }

    bulkEditApply() {

    }

    docChunkStrategyChange(document: TableDocument, value: string) {
        this.docFieldChange$.next({
            documentId: document.naive_rag_document_id,
            documentName: document.file_name,
            field: 'chunk_strategy',
            value
        });
    }

    docChunkSizeChange(document: TableDocument, value: number | string) {
        this.docFieldChange$.next({
            documentId: document.naive_rag_document_id,
            documentName: document.file_name,
            field: 'chunk_size',
            value
        });
    }

    docOverlapChange(document: TableDocument, value: number | string) {
        this.docFieldChange$.next({
            documentId: document.naive_rag_document_id,
            documentName: document.file_name,
            field: 'chunk_overlap',
            value
        });
    }


    tuneChunk(row: any) {
        console.log('open modal', row);
    }

    hangleUpdateError(e: HttpErrorResponse, field: string, documentName: string) {
        if (e.status === 400) {
            this.toastService.error(`Update failed: ${e.error.error}`);
        } else {
            this.toastService.error(`Failed to update field ${field} in document: ${documentName}`);
        }
    }
}
