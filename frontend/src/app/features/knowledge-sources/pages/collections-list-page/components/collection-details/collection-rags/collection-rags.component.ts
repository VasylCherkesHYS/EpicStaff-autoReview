import {ChangeDetectionStrategy, Component} from "@angular/core";
import {AppIconComponent} from "../../../../../../../shared/components/app-icon/app-icon.component";

@Component({
    selector: 'app-collection-details-rags',
    templateUrl: 'collection-rags.component.html',
    styleUrls: ['./collection-rags.component.scss'],
    imports: [
        AppIconComponent
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionRagsComponent {}
