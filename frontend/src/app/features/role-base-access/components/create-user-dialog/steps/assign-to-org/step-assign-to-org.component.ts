import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import {
    AppTableCellDirective,
    AppTableColumnDef,
    AppTableComponent,
    MultiSelectComponent,
    MultiSelectTriggerDirective,
    SearchComponent,
    TableRow,
} from '@shared/components';
import { UserService } from '@shared/services';

import { USER_ROLES } from '../../../../constants/user-roles-select-items.constant';
import { OrganizationsService } from '../../../../services/organizations.service';
import { OrgAvatarComponent } from '../../../org-avatar/org-avatar.component';

@Component({
    selector: 'app-step-assign-to-org',
    templateUrl: './step-assign-to-org.component.html',
    styleUrls: ['./step-assign-to-org.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        AppTableCellDirective,
        AppTableComponent,
        MultiSelectComponent,
        MultiSelectTriggerDirective,
        SearchComponent,
        OrgAvatarComponent,
    ],
})
export class StepAssignToOrgComponent implements OnInit {
    private destroyRef = inject(DestroyRef);
    private dialogRef = inject(DialogRef);
    private organizationsService = inject(OrganizationsService);
    private userService = inject(UserService);

    usersTableData = signal<TableRow[]>([]);
    searchTerm = signal('');

    filteredOrganizations = computed(() => {
        const term = this.searchTerm().toLowerCase().trim();
        if (!term) return this.usersTableData();
        return this.usersTableData().filter(
            (row) =>
                (row['name'] as string)?.toLowerCase().includes(term) ||
                (row['email'] as string)?.toLowerCase().includes(term)
        );
    });

    isOrganizationsLoading = signal(true);

    readonly columns: AppTableColumnDef[] = [
        { key: 'organization', label: 'Organization', width: '1fr' },
        { key: 'roles', label: 'System Role', width: '1fr', filterItems: USER_ROLES },
    ];

    readonly selectedOrganizations = signal<TableRow[]>([]);

    ngOnInit() {
        // todo org service
        // this.userService
        //     .getUsers()
        //     .pipe(
        //         takeUntilDestroyed(this.destroyRef),
        //         map((users) =>
        //             users.map((user) => ({
        //                 id: user.id,
        //                 name: user.name,
        //                 roles: user.roles,
        //                 initials: user.initials,
        //                 email: user.email,
        //             }))
        //         )
        //     )
        //     .subscribe({
        //         next: (users) => {
        //             this.usersTableData.set(users);
        //             this.isUsersLoading.set(false);
        //         },
        //         error: () => this.isUsersLoading.set(false),
        //     });
    }

    onSelection(items: TableRow[]): void {
        this.selectedOrganizations.set(items);
    }

    onCancel(): void {
        this.dialogRef.close();
    }

    protected readonly USER_ROLES = USER_ROLES;
}
