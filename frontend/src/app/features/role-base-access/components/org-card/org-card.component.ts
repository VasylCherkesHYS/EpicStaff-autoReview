import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AppSvgIconComponent, ButtonComponent } from '@shared/components';

import { GetOrganizationsResponse } from '../../../../shared/models';

@Component({
    selector: 'app-org-card',
    imports: [AppSvgIconComponent, ButtonComponent],
    templateUrl: './org-card.component.html',
    styleUrls: ['./org-card.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrgCardComponent {
    organization = input.required<GetOrganizationsResponse>();
}
