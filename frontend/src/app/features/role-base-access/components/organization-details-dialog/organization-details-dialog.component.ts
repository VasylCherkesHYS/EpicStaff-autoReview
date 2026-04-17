import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AppSvgIconComponent } from '@shared/components';

import { OrgComponentsTabComponent } from './org-components-tab/org-components-tab.component';
import { OrgUsersTabComponent } from './org-users-tab/org-users-tab.component';

@Component({
    selector: 'app-organization-details-dialog',
    templateUrl: './organization-details-dialog.component.html',
    styleUrls: ['./organization-details-dialog.component.scss'],
    imports: [AppSvgIconComponent, OrgUsersTabComponent, OrgComponentsTabComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationDetailsDialogComponent {
    private readonly dialogRef = inject(DialogRef);

    readonly activeTab = signal<'users' | 'components'>('users');

    onClose(): void {
        this.dialogRef.close();
    }
}
