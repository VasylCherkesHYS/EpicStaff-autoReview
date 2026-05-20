import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AppSvgIconComponent } from '@shared/components';
import { GetRoleResponse, Permission } from '@shared/models';

import { PermissionsTableComponent } from '../permissions-table/permissions-table.component';
import { UserAvatarComponent } from '../user-avatar/user-avatar.component';

@Component({
    selector: 'app-role-info-dialog',
    templateUrl: './role-info-dialog.component.html',
    styleUrls: ['./role-info-dialog.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [AppSvgIconComponent, PermissionsTableComponent, UserAvatarComponent],
})
export class RoleInfoDialogComponent {
    private dialogRef = inject(DialogRef);
    readonly role = inject<GetRoleResponse>(DIALOG_DATA);

    readonly selectedPermissions = new Set<Permission>(this.role.permissions);

    onClose(): void {
        this.dialogRef.close();
    }
}
