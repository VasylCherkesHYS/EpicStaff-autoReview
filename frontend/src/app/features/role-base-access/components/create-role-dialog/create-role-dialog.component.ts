import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
    AppSvgIconComponent,
    ButtonComponent,
    CheckboxComponent,
    CustomInputComponent,
    SearchComponent,
    ValidationErrorsComponent,
} from '@shared/components';
import { GetRoleResponse, Permission } from '@shared/models';
import { take } from 'rxjs';

import {
    ACTION_ICONS,
    PERMISSION_ACTIONS,
    PERMISSION_GROUPS,
    PermissionAction,
    PermissionGroupDef,
} from '../../constants/permission-table.constant';
import { RolesService } from '../../services/admin/roles.service';

export interface CreateRoleDialogData {
    role?: GetRoleResponse;
}

const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap((g) =>
    g.resources.flatMap((r) => Object.values(r.actions))
).filter((p): p is Permission => p !== undefined);

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
        SearchComponent,
        AppSvgIconComponent,
        CheckboxComponent,
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
    collapsedGroups = signal<Set<string>>(new Set());
    searchTerm = signal('');
    isSubmitting = signal(false);

    totalSelected = computed(() => this.selectedPermissions().size);

    filteredGroups = computed(() => {
        const term = this.searchTerm().toLowerCase().trim();
        if (!term) return PERMISSION_GROUPS;
        return PERMISSION_GROUPS.map((g) => ({
            ...g,
            resources: g.resources.filter(
                (r) => r.name.toLowerCase().includes(term) || r.description.toLowerCase().includes(term)
            ),
        }));
    });

    // Map<groupName, { selected, total }> — recomputed when selection changes
    groupCounts = computed(() => {
        const selected = this.selectedPermissions();
        return new Map(
            PERMISSION_GROUPS.map((g) => {
                const all = g.resources
                    .flatMap((r) => Object.values(r.actions))
                    .filter((p): p is Permission => p !== undefined);
                return [g.name, { selected: all.filter((p) => selected.has(p)).length, total: all.length }];
            })
        );
    });

    isGroupCollapsed(groupName: string): boolean {
        return this.collapsedGroups().has(groupName);
    }

    toggleGroup(groupName: string): void {
        this.collapsedGroups.update((set) => {
            const next = new Set(set);
            next.has(groupName) ? next.delete(groupName) : next.add(groupName);
            return next;
        });
    }

    togglePermission(permission: Permission): void {
        this.selectedPermissions.update((set) => {
            const next = new Set(set);
            next.has(permission) ? next.delete(permission) : next.add(permission);
            return next;
        });
    }

    selectAll(): void {
        this.selectedPermissions.set(new Set(ALL_PERMISSIONS));
    }

    clearAll(): void {
        this.selectedPermissions.set(new Set());
    }

    selectGroupAll(group: PermissionGroupDef): void {
        const perms = group.resources
            .flatMap((r) => Object.values(r.actions))
            .filter((p): p is Permission => p !== undefined);
        this.selectedPermissions.update((set) => {
            const next = new Set(set);
            perms.forEach((p) => next.add(p));
            return next;
        });
    }

    clearGroup(group: PermissionGroupDef): void {
        const perms = group.resources
            .flatMap((r) => Object.values(r.actions))
            .filter((p): p is Permission => p !== undefined);
        this.selectedPermissions.update((set) => {
            const next = new Set(set);
            perms.forEach((p) => next.delete(p));
            return next;
        });
    }

    actionLabel(action: PermissionAction): string {
        return action.charAt(0).toUpperCase() + action.slice(1);
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

    readonly PERMISSION_ACTIONS = PERMISSION_ACTIONS;
    readonly ACTION_ICONS = ACTION_ICONS;
}
