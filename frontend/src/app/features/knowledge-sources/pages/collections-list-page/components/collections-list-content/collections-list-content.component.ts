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

@Component({
    selector: "app-collections-list-content",
    styleUrls: ["./collections-list-content.component.scss"],
    templateUrl: "./collections-list-content.component.html",
    imports: [
        AppIconComponent,
        FormsModule,
        ReactiveFormsModule
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionsListContentComponent implements OnInit {
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

    onDelete(): void {
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
}
