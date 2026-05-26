import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AppSvgIconComponent } from '@shared/components';

import { GetCollectionRequest } from '../../../../../models/collection.model';

@Component({
    selector: 'app-collection',
    templateUrl: './collection.component.html',
    styleUrls: ['./collection.component.scss'],
    imports: [AppSvgIconComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionComponent {
    collection = input.required<GetCollectionRequest>();
    selected = input<boolean>(false);
}
