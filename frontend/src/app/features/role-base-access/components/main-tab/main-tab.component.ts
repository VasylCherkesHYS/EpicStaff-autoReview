import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { AppSvgIconComponent, ButtonComponent } from '@shared/components';
import { GetOrganizationsResponse } from '@shared/models';

import { CreateOrganizationDialogComponent } from '../create-organization-dialog/create-organization-dialog.component';
import { OrgCardComponent } from '../org-card/org-card.component';
import { StatCardComponent } from '../stat-card/stat-card.component';

interface StatCard {
    label: string;
    value: number;
    delta: number | null;
    deltaLabel: string;
    icon: string;
}

@Component({
    selector: 'app-workspace-main',
    imports: [StatCardComponent, ButtonComponent, OrgCardComponent, AppSvgIconComponent],
    templateUrl: './main-tab.component.html',
    styleUrls: ['./main-tab.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainTabComponent {
    private dialog = inject(Dialog);
    private destroyRef = inject(DestroyRef);

    public stats: StatCard[] = [
        { label: 'TOTAL ORGANIZATIONS', value: 3, delta: 2, deltaLabel: 'this month', icon: 'buildings' },
        { label: 'TOTAL USERS', value: 247, delta: 18, deltaLabel: 'this month', icon: 'profile' },
        { label: 'ROLES', value: 28, delta: 2, deltaLabel: 'this month', icon: 'briefcase' },
        { label: 'RUNNING FLOWS', value: 16, delta: 8, deltaLabel: 'this month', icon: 'rate' },
    ];

    public organizations: GetOrganizationsResponse[] = [
        {
            id: 1,
            initial: 'E',
            active: true,
            name: 'EpicStaff',
            users: 34,
            projects: 34,
            agents: 34,
            tools: 34,
            flows: 34,
            knowledges: 12,
        },
        {
            id: 2,
            initial: 'E',
            active: true,
            name: 'EpicStaff',
            users: 34,
            projects: 34,
            agents: 34,
            tools: 34,
            flows: 34,
            knowledges: 12,
        },
        {
            id: 3,
            initial: 'E',
            active: true,
            name: 'EpicStaff',
            users: 34,
            projects: 34,
            agents: 34,
            tools: 34,
            flows: 34,
            knowledges: 12,
        },
        {
            id: 4,
            initial: 'E',
            active: true,
            name: 'EpicStaff',
            users: 34,
            projects: 34,
            agents: 34,
            tools: 34,
            flows: 34,
            knowledges: 12,
        },
        {
            id: 5,
            initial: 'E',
            active: true,
            name: 'EpicStaff',
            users: 34,
            projects: 34,
            agents: 34,
            tools: 34,
            flows: 34,
            knowledges: 12,
        },
    ];

    onCreateOrganization(): void {
        this.dialog.open(CreateOrganizationDialogComponent, {
            width: 'calc(100vw - 2rem)',
            height: 'calc(100vh - 2rem)',
            disableClose: true,
        });
    }
}
