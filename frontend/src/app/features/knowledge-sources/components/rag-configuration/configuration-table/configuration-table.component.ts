import {
    ChangeDetectionStrategy,
    Component,
    computed, DestroyRef,
    inject,
    input,
    linkedSignal,
    OnInit,
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
import {NaiveRagDocumentConfig, UpdateNaiveRagDocumentResponse} from "../../../models/rag.model";
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
    field: keyof TableDocument;
    value: any;
};

type SortState = {
    column: 'chunk_size' | 'chunk_overlap';
    dir: 'asc' | 'desc';
} | null;

type FieldUpdateStatus = 'idle' | 'pending' | 'success' | 'error';

type DocumentUpdateStatus = {
    [K in keyof TableDocument]: FieldUpdateStatus;
};

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
    documents = input<NaiveRagDocumentConfig[]>([]);
    tableDocuments = computed<TableDocument[]>(() => {
        return this.documents().map(d => ({...d, selected: false}))
    });

    allSelected = computed(() => this.filteredAndSorted().every(r => r.selected));
    indeterminate = computed(() => {
        const someSelected = this.filteredAndSorted().some(r => r.selected);
        return someSelected && !this.allSelected();
    });

    filesFilter = signal<any[]>([]);
    chunkStrategyFilter = signal<any[]>([]);
    sort = signal<SortState>(null);
    fieldUpdateStatus = signal<Record<number, DocumentUpdateStatus>>({});

    filteredAndSorted = linkedSignal<TableDocument[]>(() => {
        let data = this.tableDocuments();

        data = this.applyFileNameFilter(data);
        data = this.applyChunkStrategyFilter(data);
        data = this.sortDocuments(data);

        return data;
    });

    ngOnInit() {
        this.docFieldChange$.pipe(
            groupBy(change => change.documentId), // групуємо по документу
            mergeMap(group$ => group$.pipe(
                debounceTime(300),
                switchMap(change => this.updateDocumentField(change))
            )),
            takeUntilDestroyed(this.destroyRef)
        ).subscribe();
    }

    docFieldChange(document: TableDocument, field: keyof TableDocument, value: string | number) {
        this.docFieldChange$.next({
            documentId: document.naive_rag_document_id,
            documentName: document.file_name,
            field,
            value
        });
    }

    private updateDocumentField(change: DocFieldChange) {
        const { documentId, documentName, field, value } = change;
        if (value === null) return EMPTY;

        this.setFieldStatus(documentId, field, 'pending');

        return this.naiveRagService.updateDocumentConfig(
            this.ragId(),
            documentId,
            { [field]: value }
        ).pipe(
            tap(response => this.handleUpdateSuccess(response, documentId)),
            catchError(error => this.handleUpdateError(error, field, documentName, documentId))
        );
    }

    private setFieldStatus(
        documentId: number,
        field: keyof TableDocument,
        status: FieldUpdateStatus
    ) {
        this.fieldUpdateStatus.update(records => ({
            ...records,
            [documentId]: {
                ...records[documentId],
                [field]: status
            }
        }));
    }

    private handleUpdateSuccess(
        response: UpdateNaiveRagDocumentResponse,
        documentId: number
    ) {
        const { config } = response;

        this.toastService.success('Document updated');
        this.fieldUpdateStatus.update(records => {
            const { [documentId]: _, ...rest } = records;
            return rest;
        });

        this.filteredAndSorted.update(items =>
            items.map(i =>
                i.document_id === config.document_id ? { ...config, selected: i.selected } : i
            )
        );
    }

    private handleUpdateError(
        error: HttpErrorResponse,
        field: keyof TableDocument,
        documentName: string,
        documentId: number
    ) {
        this.setFieldStatus(documentId, field, 'error');

        if (error.status === 400) {
            this.toastService.error(`Update failed: ${error.error.error}`);
        } else {
            this.toastService.error(`Failed to update field ${field} in document: ${documentName}`);
        }

        return EMPTY;
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

    private applyFileNameFilter(data: TableDocument[]): TableDocument[] {
        const filesFilter = this.filesFilter();
        if (!filesFilter.length) return data;

        return data.filter(d => filesFilter.includes(d.file_name));
    }

    private applyChunkStrategyFilter(data: TableDocument[]): TableDocument[] {
        const strategyFilter = this.chunkStrategyFilter();
        if (!strategyFilter.length) return data;

        return data.filter(d => strategyFilter.includes(d.chunk_strategy));
    }

    private sortDocuments(data: TableDocument[]): TableDocument[] {
        const sort = this.sort();
        if (!sort) return data;

        const dir = sort.dir === 'asc' ? 1 : -1;
        const col = sort.column;

        return [...data].sort((a, b) => (a[col] - b[col]) * dir);
    }

    bulkEditApply() {

    }

    tuneChunk(row: any) {
        console.log('open modal', row);
    }
}
