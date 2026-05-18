import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonComponent, CustomInputComponent, ValidationErrorsComponent } from '@shared/components';
import { GetRoleResponse, Permission } from '@shared/models';
import { take } from 'rxjs';

import { PERMISSION_GROUPS, PermissionGroupDef } from '../../constants/permission-table.constant';
import { RolesService } from '../../services/admin/roles.service';
import { PermissionsTableComponent } from '../permissions-table/permissions-table.component';

export interface CreateRoleDialogData {
    role?: GetRoleResponse;
}

@Component({
    selector: 'app-create-role-dialog',
    templateUrl: './create-role-dialog.component.html',
    styleUrls: ['./create-role-dialog.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ButtonComponent,
        ReactiveFormsModule,
        CustomInputComponent,
        ValidationErrorsComponent,
        PermissionsTableComponent,
    ],
})
export class CreateRoleDialogComponent {
    private dialogRef = inject(DialogRef);
    private dialogData = inject<CreateRoleDialogData>(DIALOG_DATA, { optional: true });
    private rolesService = inject(RolesService);

    readonly isEditMode = !!this.dialogData?.role;

    form = new FormGroup({
        name: new FormControl(this.dialogData?.role?.name ?? '', {
            nonNullable: true,
            validators: [Validators.required, Validators.minLength(3), Validators.maxLength(30)],
        }),
        description: new FormControl(this.dialogData?.role?.description ?? ''),
    });

    selectedPermissions = signal<Set<Permission>>(new Set(this.dialogData?.role?.permissions ?? []));
    isSubmitting = signal(false);

    onPermissionToggle(permission: Permission): void {
        this.selectedPermissions.update((set) => {
            const next = new Set(set);
            next.has(permission) ? next.delete(permission) : next.add(permission);
            return next;
        });
    }

    onSelectAll(): void {
        const all = PERMISSION_GROUPS.flatMap((g) => g.resources.flatMap((r) => Object.values(r.actions))).filter(
            (p): p is Permission => p !== undefined
        );
        this.selectedPermissions.set(new Set(all));
    }

    onClearAll(): void {
        this.selectedPermissions.set(new Set());
    }

    onGroupSelectAll(group: PermissionGroupDef): void {
        const original = PERMISSION_GROUPS.find((g) => g.name === group.name)!;
        const perms = original.resources
            .flatMap((r) => Object.values(r.actions))
            .filter((p): p is Permission => p !== undefined);
        this.selectedPermissions.update((set) => {
            const next = new Set(set);
            perms.forEach((p) => next.add(p));
            return next;
        });
    }

    onGroupClear(group: PermissionGroupDef): void {
        const original = PERMISSION_GROUPS.find((g) => g.name === group.name)!;
        const perms = original.resources
            .flatMap((r) => Object.values(r.actions))
            .filter((p): p is Permission => p !== undefined);
        this.selectedPermissions.update((set) => {
            const next = new Set(set);
            perms.forEach((p) => next.delete(p));
            return next;
        });
    }

    onCancel(): void {
        this.dialogRef.close();
    }

    onSubmit(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        this.isSubmitting.set(true);

        const { name, description } = this.form.getRawValue();
        const permissions = Array.from(this.selectedPermissions());
        const data = { name, description, permissions };

        const action$ = this.isEditMode
            ? this.rolesService.updateRole(this.dialogData!.role!.id, data)
            : this.rolesService.createRole(data);

        action$.pipe(take(1)).subscribe({
            next: () => {
                this.isSubmitting.set(false);
                this.dialogRef.close(true);
            },
            error: () => this.isSubmitting.set(false),
        });
    }
}
