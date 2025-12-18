import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    effect,
    inject,
    model,
    OnInit,
    signal
} from "@angular/core";
import {AppIconComponent} from "../../../../../../shared/components/app-icon/app-icon.component";
import {FormControl, FormsModule, ReactiveFormsModule, Validators} from "@angular/forms";
import {CreateCollectionDtoResponse} from "../../../../models/collection.model";
import {CollectionsStorageService} from "../../../../services/collections-storage.service";
import {debounceTime, distinctUntilChanged, skip, switchMap} from "rxjs/operators";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {filter} from "rxjs";
import {DragDropAreaComponent} from "../../../../../../shared/components/drag-drop-area/drag-drop-area.component";
import {FILE_TYPES} from "../../../../constants/constants";
import {DisplayedListDocument} from "../../../../models/document.model";
import {CollectionFilesComponent} from "./collection-files/collection-files.component";
import {SelectComponent} from "../../../../../../shared/components/select/select.component";
import {CollectionRagsComponent} from "./collection-rags/collection-rags.component";
import {CollectionInfoComponent} from "./collection-info/collection-info.component";

@Component({
    selector: "app-collection-details",
    styleUrls: ["./collection-details.component.scss"],
    templateUrl: "./collection-details.component.html",
    imports: [
        AppIconComponent,
        FormsModule,
        ReactiveFormsModule,
        DragDropAreaComponent,
        CollectionFilesComponent,
        SelectComponent,
        CollectionRagsComponent,
        CollectionInfoComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionDetailsComponent implements OnInit {
    private destroyRef = inject(DestroyRef);
    selectedCollectionId = model<number | null>(null);
    fullCollection = signal<CreateCollectionDtoResponse | null>(null);
    collectionName: FormControl = new FormControl("", Validators.required);

    private collectionsStorageService = inject(CollectionsStorageService);

    constructor() {
        effect(() => {
            const id = this.selectedCollectionId();

            if (id) {
                this.collectionsStorageService.getFullCollection(id)
                    .pipe(takeUntilDestroyed(this.destroyRef))
                    .subscribe(c => {
                        this.fullCollection.set(c);
                        this.collectionName.setValue(this.fullCollection()?.collection_name, {emitEvent: false});
                    });
            }
        });
    }

    ngOnInit() {
        this.collectionName.valueChanges.pipe(
            debounceTime(400),
            distinctUntilChanged(),
            filter(() => !!this.fullCollection()),
            switchMap((collection_name: string) => {
                const id = this.fullCollection()!.collection_id;
                return this.collectionsStorageService.updateCollectionById(id, { collection_name });
            }),
            takeUntilDestroyed(this.destroyRef)
        ).subscribe();
    }

    onCollectionDelete(): void {
        const id = this.fullCollection()?.collection_id;
        if (id) {
            this.collectionsStorageService.deleteCollectionById(id)
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe((res) => {
                    if (!res) return;
                    this.selectedCollectionId.set(null);
                    this.fullCollection.set(null);
                });
        }
    }

    onFilesDropped(files: FileList) {
        console.log('files droppedsd')
    }

    protected readonly FILE_TYPES = FILE_TYPES;
}
