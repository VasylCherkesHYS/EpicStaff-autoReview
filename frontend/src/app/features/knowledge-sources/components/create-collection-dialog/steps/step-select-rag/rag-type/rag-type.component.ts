import {ChangeDetectionStrategy, Component, input} from "@angular/core";
import {AppIconComponent} from "../../../../../../../shared/components/app-icon/app-icon.component";
import {RagType} from "../../../../../models/rag.model";


@Component({
    selector: 'app-rag-type',
    templateUrl: './rag-type.component.html',
    styleUrls: ['./rag-type.component.scss'],
    imports: [
        AppIconComponent
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class RagTypeComponent {
    ragType = input.required<RagType>();
    selected = input<boolean>(false);
}
