import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
    AppSvgIconComponent,
    AppTableCellDirective,
    AppTableColumnDef,
    AppTableComponent,
    ButtonComponent,
    LoadingSpinnerComponent,
    SearchComponent,
    SelectItem,
    TableRow,
} from '@shared/components';
import { GetUserResponse } from '@shared/models';
import { UserService } from '@shared/services';

import { CreateUserDialogComponent } from '../../../components/create-user-dialog/create-user-dialog.component';
import { OrgAvatarComponent } from '../../../components/org-avatar/org-avatar.component';
import { StatusBadgeComponent } from '../../../components/status-badge/status-badge.component';
import { UserAvatarComponent } from '../../../components/user-avatar/user-avatar.component';

interface UserOrg {
    id: number;
    name: string;
}

const ORG_ITEMS: SelectItem[] = [
    { name: 'EpicStaff', value: 1 },
    { name: 'EpicFlow', value: 2 },
    { name: 'MYM', value: 3 },
];

const STATUS_ITEMS: SelectItem[] = [
    { name: 'Online', value: 'online' },
    { name: 'Invited', value: 'invited' },
    { name: 'Offline', value: 'offline' },
];

// Mock extra data keyed by index (service doesn't return org/status yet)
const MOCK_ORGS: UserOrg[][] = [
    [
        { id: 1, name: 'EpicStaff' },
        { id: 2, name: 'EpicFlow' },
        { id: 3, name: 'MYM' },
    ],
    [
        { id: 1, name: 'EpicStaff' },
        { id: 3, name: 'MYM' },
    ],
    [],
];
const MOCK_STATUSES = ['online', 'invited', 'offline'] as const;
const MOCK_LAST_ACTIVE: (Date | null)[] = [new Date('2026-03-12'), null, new Date('2026-03-12')];

@Component({
    selector: 'app-users-tab',
    templateUrl: './users-tab.component.html',
    styleUrls: ['./users-tab.component.scss'],
    standalone: true,
    imports: [
        AppTableComponent,
        AppTableCellDirective,
        AppSvgIconComponent,
        ButtonComponent,
        SearchComponent,
        LoadingSpinnerComponent,
        StatusBadgeComponent,
        UserAvatarComponent,
        OrgAvatarComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersTabComponent implements OnInit {
    private readonly dialog = inject(Dialog);
    private readonly destroyRef = inject(DestroyRef);
    private readonly userService = inject(UserService);

    readonly usersData = signal<TableRow[]>([]);
    readonly searchTerm = signal('');
    readonly isLoading = signal(true);

    readonly filteredUsers = computed(() => {
        const term = this.searchTerm().toLowerCase().trim();
        if (!term) return this.usersData();
        return this.usersData().filter(
            (row) => String(row['id']).includes(term) || (row['name'] as string)?.toLowerCase().includes(term)
        );
    });

    readonly columns: AppTableColumnDef[] = [
        { key: 'user', label: 'USER', width: '1fr' },
        { key: 'roles', label: 'SYSTEM ROLE', width: '1fr' },
        { key: 'organization', label: 'ORGANIZATION', width: '1fr', filterItems: ORG_ITEMS },
        { key: 'lastActive', label: 'LAST ACTIVE', width: '160px' },
        { key: 'status', label: 'STATUS', width: '160px', filterItems: STATUS_ITEMS },
        { key: 'actions', label: 'ACTIONS', width: '120px', align: 'center' },
    ];

    ngOnInit(): void {
        this.userService
            .getUsers()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (users) => {
                    this.usersData.set(users.map((u, i) => this.mapToRow(u, i)));
                    this.isLoading.set(false);
                },
                error: () => this.isLoading.set(false),
            });
    }

    formatDate(date: unknown): string {
        if (!(date instanceof Date)) return '';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    getRelativeTime(date: unknown): string {
        if (!(date instanceof Date)) return '';
        const diffMs = Date.now() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 60) return `${diffMins} m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} h ago`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 30) return `${diffDays} d ago`;
        return `${Math.floor(diffDays / 30)} m ago`;
    }

    statusLabel(status: string): string {
        const labels: Record<string, string> = { online: 'Online', invited: 'Invited', offline: 'Offline' };
        return labels[status] ?? status;
    }

    onCreateUser(): void {
        this.dialog.open(CreateUserDialogComponent, {
            width: 'calc(100vw - 2rem)',
            height: 'calc(100vh - 2rem)',
            disableClose: true,
        });
    }

    private mapToRow(user: GetUserResponse, index: number): TableRow {
        const orgs = MOCK_ORGS[index] ?? [];
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            roles: 'Admin, Super Admin',
            // organization stores IDs for table-level array filtering
            organization: orgs.map((o) => o.id),
            // organizationDetails stores full objects for display
            organizationDetails: orgs,
            lastActive: MOCK_LAST_ACTIVE[index] ?? null,
            status: MOCK_STATUSES[index] ?? 'offline',
        };
    }
}
