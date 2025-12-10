import {ChangeDetectionStrategy, Component, input, model, output, Signal, signal} from "@angular/core";
import {ButtonComponent} from "../../../../../../shared/components/buttons/button/button.component";
import {AppIconComponent} from "../../../../../../shared/components/app-icon/app-icon.component";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {MatOption, MatSelect} from "@angular/material/select";
import {GetCollectionRequest} from "../../../../models/collection.model";
import {CollectionComponent} from "./collection/collection.component";

@Component({
    selector: 'app-collections-list-sidebar',
    templateUrl: './collections-list-sidebar.component.html',
    styleUrls: ['./collections-list-sidebar.component.scss'],
    imports: [
        ButtonComponent,
        AppIconComponent,
        ReactiveFormsModule,
        FormsModule,
        MatSelect,
        MatOption,
        CollectionComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionsListItemSidebarComponent {
    searchTerm = signal<string>('');
    collections = input<GetCollectionRequest[]>([]);

    selectedCollectionId = model<number | null>();

    onCreateCollection = output();

    onSearchTermChange(searchTerm: string): void {
        this.searchTerm.set(searchTerm);
    }

    clearSearch(): void {
        this.searchTerm.set('');
    }
}
