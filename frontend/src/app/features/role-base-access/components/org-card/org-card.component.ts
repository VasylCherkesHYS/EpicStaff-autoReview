import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, input } from '@angular/core';
import { AppSvgIconComponent, ButtonComponent } from '@shared/components';

import { GetOrganizationsResponse } from '../../../../shared/models/role-based-access/organization.model';
import { OrgAvatarComponent } from '../org-avatar/org-avatar.component';
import { OrganizationDetailsDialogComponent } from '../organization-details-dialog/organization-details-dialog.component';

@Component({
    selector: 'app-org-card',
    imports: [AppSvgIconComponent, ButtonComponent, OrgAvatarComponent],
    templateUrl: './org-card.component.html',
    styleUrls: ['./org-card.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrgCardComponent {
    private dialog = inject(Dialog);
    private destroyRef = inject(DestroyRef);

    organization = input.required<GetOrganizationsResponse>();

    onOpen(): void {
        const id = this.organization().id;

        this.dialog.open(OrganizationDetailsDialogComponent, {
            width: 'calc(100vw - 2rem)',
            height: 'calc(100vh - 2rem)',
            disableClose: true,
            data: { id },
        });
    }
}
