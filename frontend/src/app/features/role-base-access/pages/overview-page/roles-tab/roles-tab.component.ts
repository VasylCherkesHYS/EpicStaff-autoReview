import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
    AppSvgIconComponent,
    AppTableCellDirective,
    AppTableColumnDef,
    AppTableComponent,
    ButtonComponent,
    ConfirmationDialogService,
    SearchComponent,
    TableRow,
} from '@shared/components';
import { GetRoleResponse } from '@shared/models';
import { getRelativeTime } from '@shared/utils';

import { ToastService } from '../../../../../services/notifications';
import {
    CreateRoleDialogComponent,
    CreateRoleDialogData,
} from '../../../components/create-role-dialog/create-role-dialog.component';
import { RolesService } from '../../../services/admin/roles.service';

@Component({
    selector: 'app-roles-tab',
    templateUrl: './roles-tab.component.html',
    styleUrls: ['./roles-tab.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [AppTableComponent, AppTableCellDirective, AppSvgIconComponent, ButtonComponent, SearchComponent],
})
export class RolesTabComponent {
    private dialog = inject(Dialog);
    private destroyRef = inject(DestroyRef);
    private toast = inject(ToastService);
    private confirmation = inject(ConfirmationDialogService);
    protected rolesService = inject(RolesService);

    readonly searchTerm = signal('');

    readonly columns: AppTableColumnDef[] = [
        { key: 'name', label: 'ROLE NAME', width: '2fr' },
        { key: 'description', label: 'DESCRIPTION', width: '3fr' },
        { key: 'members', label: 'MEMBERS', width: '1fr' },
        { key: 'lastModified', label: 'LAST MODIFIED', width: '1.5fr' },
        { key: 'actions', label: 'ACTIONS', width: '1fr', align: 'center' },
    ];

    readonly tableData = computed<TableRow[]>(() =>
        this.rolesService.roles().map((role) => ({
            id: role.id,
            name: role.name,
            description: role.description,
            members: role.member_count,
            lastModified: new Date(role.updated_at),
            isBuiltIn: role.is_built_in,
        }))
    );

    readonly filteredRoles = computed<TableRow[]>(() => {
        const term = this.searchTerm().toLowerCase().trim();
        if (!term) return this.tableData();
        return this.tableData().filter(
            (row) =>
                (row['name'] as string)?.toLowerCase().includes(term) ||
                (row['description'] as string)?.toLowerCase().includes(term)
        );
    });

    onCreateRole(): void {
        this.openDialog();
    }

    onEditRole(row: TableRow): void {
        const role = this.rolesService.roles().find((r) => r.id === row['id']);
        if (role) this.openDialog(role);
    }

    onDeleteRole(row: TableRow): void {
        const id = row['id'] as number;
        this.confirmation
            .confirm({
                title: 'Delete the role?',
                message: `The ${row['name']} role will be deleted.`,
                caution: 'Permissions will be revoked for all members with this role',
                type: 'danger',
                confirmText: 'Delete',
                cancelText: 'Cancel',
            })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((confirmed) => {
                if (confirmed !== true) return;
                this.rolesService
                    .deleteRole(id)
                    .pipe(takeUntilDestroyed(this.destroyRef))
                    .subscribe({
                        next: () => this.toast.success('Role deleted successfully'),
                        error: (e) => this.toast.error(e.error?.message),
                    });
            });
    }

    formatDate(date: unknown): string {
        if (!(date instanceof Date)) return '';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    protected readonly getRelativeTime = getRelativeTime;

    private openDialog(role?: GetRoleResponse): void {
        const data: CreateRoleDialogData = { role };
        const ref = this.dialog.open(CreateRoleDialogComponent, {
            width: 'calc(100vw - 2rem)',
            height: 'calc(100vh - 2rem)',
            disableClose: true,
            data,
        });
        ref.closed.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
            if (!result) return;
            this.toast.success(role ? 'Role updated successfully.' : 'Role created successfully.');
        });
    }
}
