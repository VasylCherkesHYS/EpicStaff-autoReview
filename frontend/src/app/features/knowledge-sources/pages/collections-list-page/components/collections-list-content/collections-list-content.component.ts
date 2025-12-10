import {ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, model, OnInit} from "@angular/core";
import {AppIconComponent} from "../../../../../../shared/components/app-icon/app-icon.component";
import {FormControl, FormsModule, ReactiveFormsModule, Validators} from "@angular/forms";
import {CreateCollectionDtoResponse} from "../../../../models/collection.model";
import {CollectionsStorageService} from "../../../../services/collections-storage.service";
import {debounceTime, distinctUntilChanged, switchMap} from "rxjs/operators";
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
    selectedCollection = model<CreateCollectionDtoResponse | null>(null);

    collectionName: FormControl = new FormControl("", Validators.required);

    private collectionsStorageService = inject(CollectionsStorageService);

    constructor() {
        effect(() => {
            if (this.selectedCollection()) {
                this.collectionName.setValue(this.selectedCollection()!.collection_name);
            }
        });
    }

    ngOnInit() {
        this.collectionName.setValue(this.selectedCollection()?.collection_name);

        this.collectionName.valueChanges.pipe(
            debounceTime(400),
            distinctUntilChanged(),
            filter(() => !!this.selectedCollection()),
            switchMap((collection_name: string) => {
                const id = this.selectedCollection()!.collection_id;
                return this.collectionsStorageService.updateCollectionById(id, { collection_name });
            }),
            takeUntilDestroyed(this.destroyRef)
        ).subscribe();
    }

    onDelete(): void {
        const id = this.selectedCollection()?.collection_id;
        if (id) {
            this.collectionsStorageService.deleteCollectionById(id).subscribe({
                next: () => {
                    this.selectedCollection.set(null);
                }
            });
        }
    }
}
