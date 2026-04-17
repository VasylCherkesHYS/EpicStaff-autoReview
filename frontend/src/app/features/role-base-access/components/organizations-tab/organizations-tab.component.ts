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
    SelectItem,
    TableRow,
} from '@shared/components';

import { CreateOrganizationDialogComponent } from '../create-organization-dialog/create-organization-dialog.component';
import { OrganizationDetailsDialogComponent } from '../organization-details-dialog/organization-details-dialog.component';

const STATUS_ITEMS: SelectItem[] = [
    { name: 'Active', value: 'active' },
    { name: 'Deactivated', value: 'deactivated' },
];

const MOCK_ORGS: TableRow[] = [
    {
        id: 1,
        initial: 'E',
        name: 'EpicStaff',
        adminInitials: 'IB',
        adminName: 'Ivan Bohun',
        adminRole: 'Super Admin',
        members: 34,
        created: '2 years ago',
        status: 'active',
    },
    {
        id: 2,
        initial: 'E',
        name: 'EpicFlow',
        adminInitials: 'IB',
        adminName: 'Ivan Bohun',
        adminRole: 'Super Admin',
        members: 34,
        created: '2 years ago',
        status: 'active',
    },
    {
        id: 3,
        initial: 'M',
        name: 'MYM',
        adminInitials: 'IB',
        adminName: 'Ivan Bohun',
        adminRole: 'Super Admin',
        members: 34,
        created: '2 years ago',
        status: 'deactivated',
    },
];

@Component({
    selector: 'app-organizations-tab',
    templateUrl: './organizations-tab.component.html',
    styleUrls: ['./organizations-tab.component.scss'],
    imports: [AppTableComponent, AppTableCellDirective, ButtonComponent, SearchComponent, AppSvgIconComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationsTabComponent {
    private dialog = inject(Dialog);
    private destroyRef = inject(DestroyRef);
    private confirmation = inject(ConfirmationDialogService);

    readonly searchTerm = signal('');

    readonly columns: AppTableColumnDef[] = [
        { key: 'organization', label: 'Organization', width: '1fr' },
        { key: 'admin', label: 'Admin', width: '1fr' },
        { key: 'members', label: 'Members', width: '100px' },
        { key: 'created', label: 'Created', width: '140px' },
        { key: 'status', label: 'Status', width: '160px', filterItems: STATUS_ITEMS },
        { key: 'actions', label: 'Actions', width: '120px', align: 'end' },
    ];

    readonly allOrgs = MOCK_ORGS;

    readonly filteredOrgs = computed<TableRow[]>(() => {
        const term = this.searchTerm().toLowerCase().trim();
        if (!term) return this.allOrgs;
        return this.allOrgs.filter(
            (o) => String(o['name']).toLowerCase().includes(term) || String(o['id']).toLowerCase().includes(term)
        );
    });

    onCreateOrganization(): void {
        this.dialog.open(CreateOrganizationDialogComponent, {
            width: 'calc(100vw - 2rem)',
            height: 'calc(100vh - 2rem)',
            disableClose: true,
        });
    }

    onOpen(id: number): void {
        this.dialog.open(OrganizationDetailsDialogComponent, {
            width: 'calc(100vw - 2rem)',
            height: 'calc(100vh - 2rem)',
            disableClose: true,
            data: { id },
        });
    }

    onDeactivateOrganization(org: TableRow): void {
        this.confirmation
            .confirm({
                title: 'Deactivate the organization?',
                message: `The ${org['name']} organization will be deactivated, but all data will be preserved.`,
                caution: 'Access will be revoked for all members of this organization',
                type: 'danger',
                confirmText: 'Deactivate',
                cancelText: 'Cancel',
            })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe();
    }
}
