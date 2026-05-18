import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
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
import { GetRoleResponse, UserRole } from '@shared/models';
import { getRelativeTime } from '@shared/utils';

import { ProfileService } from '../../../../../services/auth/profile.service';
import { ToastService } from '../../../../../services/notifications';
import {
    CreateRoleDialogComponent,
    CreateRoleDialogData,
} from '../../../components/create-role-dialog/create-role-dialog.component';
import { RoleInfoDialogComponent } from '../../../components/role-info-dialog/role-info-dialog.component';
import { AdminUserService } from '../../../services/admin/admin-user.service';
import { RolesService } from '../../../services/admin/roles.service';
import { UserService } from '../../../services/users/user.service';
import { NormalizedUser } from '../../../strategies/users/user-fetch.strategy';
import { createUserFetchStrategy } from '../../../strategies/users/user-fetch-strategy.factory';

@Component({
    selector: 'app-roles-tab',
    templateUrl: './roles-tab.component.html',
    styleUrls: ['./roles-tab.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [AppTableComponent, AppTableCellDirective, AppSvgIconComponent, ButtonComponent, SearchComponent],
})
export class RolesTabComponent implements OnInit {
    private dialog = inject(Dialog);
    private destroyRef = inject(DestroyRef);
    private toast = inject(ToastService);
    private confirmation = inject(ConfirmationDialogService);
    private profileService = inject(ProfileService);
    private adminUserService = inject(AdminUserService);
    private userService = inject(UserService);
    protected rolesService = inject(RolesService);

    readonly searchTerm = signal('');
    private readonly normalizedUsers = signal<NormalizedUser[]>([]);

    private readonly roleMemberCounts = computed<Map<number, number>>(() => {
        const users = this.normalizedUsers();
        return new Map([
            [UserRole.SUPER_ADMIN, users.filter((u) => u.isSuperadmin).length],
            [
                UserRole.ORG_ADMIN,
                users.filter((u) => u.memberships.some((m) => m.role.id === UserRole.ORG_ADMIN)).length,
            ],
            [UserRole.MEMBER, users.filter((u) => u.memberships.some((m) => m.role.id === UserRole.MEMBER)).length],
            [UserRole.VIEWER, users.filter((u) => u.memberships.some((m) => m.role.id === UserRole.VIEWER)).length],
        ]);
    });

    ngOnInit(): void {
        createUserFetchStrategy(this.profileService, this.adminUserService, this.userService)
            .fetchUsers()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((users) => this.normalizedUsers.set(users));
    }

    readonly columns: AppTableColumnDef[] = [
        { key: 'name', label: 'ROLE NAME', width: '2fr' },
        { key: 'description', label: 'DESCRIPTION', width: '3fr' },
        { key: 'members', label: 'MEMBERS', width: '1fr' },
        { key: 'lastModified', label: 'LAST MODIFIED', width: '1.5fr' },
        { key: 'actions', label: 'ACTIONS', width: '1fr', align: 'center' },
    ];

    readonly tableData = computed<TableRow[]>(() => {
        const counts = this.roleMemberCounts();
        return this.rolesService.roles().map((role) => ({
            id: role.id,
            name: role.name,
            description: role.description,
            members: role.is_built_in ? (counts.get(role.id) ?? 0) : role.member_count,
            lastModified: new Date(role.updated_at),
            isBuiltIn: role.is_built_in,
        }));
    });

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

    onViewRole(row: TableRow): void {
        const role = this.rolesService.roles().find((r) => r.id === row['id']);
        if (!role) return;
        this.dialog.open(RoleInfoDialogComponent, {
            width: 'calc(100vw - 2rem)',
            height: 'calc(100vh - 2rem)',
            data: role,
        });
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
