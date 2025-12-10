import {OnInit, Component, ChangeDetectionStrategy, signal, inject, DestroyRef, effect} from '@angular/core'
import {
    CollectionsListContentComponent
} from "./components/collections-list-content/collections-list-content.component";
import {
    CollectionsListItemSidebarComponent
} from "./components/collections-list-sidebar/collections-list-sidebar.component";
import {SpinnerComponent} from "../../../../shared/components/spinner/spinner.component";
import {Dialog} from "@angular/cdk/dialog";
import {
    CreateCollectionDialogComponent
} from "../../components/create-collection-dialog/create-collection-dialog.component";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {CreateCollectionDtoResponse, GetCollectionRequest} from "../../models/collection.model";
import {CollectionsStorageService} from "../../services/collections-storage.service";
import {finalize} from "rxjs/operators";

@Component({
    selector: 'app-collections-list-page',
    templateUrl: './collections-list-page.component.html',
    styleUrls: ['./collections-list-page.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CollectionsListContentComponent,
        CollectionsListItemSidebarComponent,
        SpinnerComponent
    ]
})
export class CollectionsListPageComponent implements OnInit {
    private destroyRef = inject(DestroyRef);
    private dialog = inject(Dialog);
    private collectionsStorageService = inject(CollectionsStorageService);

    isLoading = signal<boolean>(true);
    collections = this.collectionsStorageService.collections;
    // collections = signal<GetCollectionRequest[]>([])
    selectedCollectionId = signal<number | null>(null);
    fullCollection = signal<CreateCollectionDtoResponse | null>(null);


    constructor() {
        effect(() => {
            const id = this.selectedCollectionId();

            if (id) {
                this.collectionsStorageService.getFullCollection(id)
                    .pipe(takeUntilDestroyed(this.destroyRef))
                    .subscribe(c => this.fullCollection.set(c));
            }
        });
    }

    ngOnInit() {
        this.getCollections();
    }

    getCollections() {
        this.isLoading.set(true);

        this.collectionsStorageService.getCollections()
            .pipe(
                takeUntilDestroyed(this.destroyRef),
                finalize(() => this.isLoading.set(false))
            )
            .subscribe();
    }

    createCollection() {
        this.collectionsStorageService.createCollection()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((collection) => {
                this.openCreateModal(collection)
            });
    }

    private openCreateModal(collection: CreateCollectionDtoResponse) {
        const modalRef = this.dialog.open(CreateCollectionDialogComponent, {
            width: 'calc(100vw - 2rem)',
            height: 'calc(100vh - 2rem)',
            data: collection
        });

    }
}
