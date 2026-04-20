import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import {
    AppTableCellDirective,
    AppTableColumnDef,
    AppTableComponent,
    ButtonComponent,
    CustomInputComponent,
    LoadingSpinnerComponent,
    MultiSelectComponent,
    MultiSelectTriggerDirective,
    SearchComponent,
    TableRow,
    ValidationErrorsComponent,
} from '@shared/components';
import { CreateOrganizationRequest, UserOrganizationRole } from '@shared/models';
import { OrganizationService, UserService } from '@shared/services';
import { map } from 'rxjs/operators';

import { USER_ROLES } from '../../constants/user-roles-select-items.constant';
import { UserAvatarComponent } from '../user-avatar/user-avatar.component';

@Component({
    selector: 'app-create-organization-dialog',
    templateUrl: './create-organization-dialog.component.html',
    styleUrls: ['./create-organization-dialog.component.scss'],
    imports: [
        ButtonComponent,
        ReactiveFormsModule,
        ValidationErrorsComponent,
        CustomInputComponent,
        AppTableComponent,
        AppTableCellDirective,
        SearchComponent,
        MultiSelectComponent,
        MultiSelectTriggerDirective,
        UserAvatarComponent,
        LoadingSpinnerComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateOrganizationDialogComponent implements OnInit {
    private destroyRef = inject(DestroyRef);
    private dialogRef = inject(DialogRef);
    private organizationService = inject(OrganizationService);
    private userService = inject(UserService);

    orgNameControl = new FormControl('', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]);

    usersTableData = signal<TableRow[]>([]);
    searchTerm = signal('');
    isUsersLoading = signal(true);
    readonly selectedUsers = signal<TableRow[]>([]);

    filteredUsers = computed(() => {
        const term = this.searchTerm().toLowerCase().trim();
        if (!term) return this.usersTableData();
        return this.usersTableData().filter(
            (row) =>
                (row['name'] as string)?.toLowerCase().includes(term) ||
                (row['email'] as string)?.toLowerCase().includes(term)
        );
    });

    readonly columns: AppTableColumnDef[] = [
        { key: 'user', label: 'User', width: '1fr' },
        { key: 'roles', label: 'System Role', width: '1fr', filterItems: USER_ROLES },
    ];

    ngOnInit() {
        this.userService
            .getUsers()
            .pipe(
                takeUntilDestroyed(this.destroyRef),
                map((users) =>
                    users.map((user) => ({
                        id: user.id,
                        name: user.name,
                        roles: user.roles,
                        email: user.email,
                    }))
                )
            )
            .subscribe({
                next: (users) => {
                    this.usersTableData.set(users);
                    this.isUsersLoading.set(false);
                },
                error: () => this.isUsersLoading.set(false),
            });
    }

    onSelection(items: TableRow[]): void {
        this.selectedUsers.set(items);
    }

    onCancel(): void {
        this.dialogRef.close();
    }

    onCreate(): void {
        if (this.orgNameControl.invalid) {
            this.orgNameControl.markAsTouched();
            return;
        }

        const request: CreateOrganizationRequest = {
            name: this.orgNameControl.value!,
            users: this.selectedUsers().map((row) => ({
                id: row['id'] as number,
                roles: (row['roles'] as UserOrganizationRole[]) ?? [],
            })),
        };

        this.organizationService
            .createOrganization(request)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => this.dialogRef.close(true),
            });
    }

    protected readonly USER_ROLES = USER_ROLES;
}
