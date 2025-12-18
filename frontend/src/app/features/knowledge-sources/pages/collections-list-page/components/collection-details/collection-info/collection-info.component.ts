import {ChangeDetectionStrategy, Component} from "@angular/core";
import {ButtonComponent} from "../../../../../../../shared/components/buttons/button/button.component";
import {AppIconComponent} from "../../../../../../../shared/components/app-icon/app-icon.component";

@Component({
    selector: 'app-collection-details-info',
    templateUrl: './collection-info.component.html',
    styleUrls: ['./collection-info.component.scss'],
    imports: [
        ButtonComponent,
        AppIconComponent
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionInfoComponent {}
