import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppSvgIconComponent, ButtonComponent, LoadingSpinnerComponent } from '@shared/components';
import { GetOrganizationsResponse } from '@shared/models';
import { OrganizationService } from '@shared/services';
import { delay } from 'rxjs/operators';

import { CreateOrganizationDialogComponent } from '../../../components/create-organization-dialog/create-organization-dialog.component';
import { OrgCardComponent } from '../../../components/org-card/org-card.component';
import { StatCardComponent } from '../../../components/stat-card/stat-card.component';
import { CardDeltaInfo, StatCardData } from '../../../components/stat-card/stat-card.interface';
import { GetWorkspaceInfoResponse, WorkspaceInfoItem } from '../../../models/workspace-main.model';
import { WorkspaceMainService } from '../../../services/workspace-main.service';

@Component({
    selector: 'app-workspace-main',
    imports: [StatCardComponent, ButtonComponent, OrgCardComponent, AppSvgIconComponent, LoadingSpinnerComponent],
    templateUrl: './main-tab.component.html',
    styleUrls: ['./main-tab.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainTabComponent implements OnInit {
    private readonly dialog = inject(Dialog);
    private readonly destroyRef = inject(DestroyRef);
    private readonly workspaceMainService = inject(WorkspaceMainService);
    private readonly organizationService = inject(OrganizationService);

    public stats = signal<StatCardData[]>([]);
    public organizations = signal<GetOrganizationsResponse[]>([]);
    public isStatsLoading = signal(true);
    public isOrgsLoading = signal(true);

    ngOnInit(): void {
        this.getMainInfo();
        this.getOrganizations();
    }

    private getMainInfo(): void {
        this.workspaceMainService
            .getMainInfo()
            .pipe(takeUntilDestroyed(this.destroyRef), delay(1000))
            .subscribe({
                next: (data) => {
                    this.stats.set(this.mapToStats(data));
                    this.isStatsLoading.set(false);
                },
                error: () => this.isStatsLoading.set(false),
            });
    }

    private getOrganizations(): void {
        this.organizationService
            .getOrganizationsByUserId(1)
            .pipe(takeUntilDestroyed(this.destroyRef), delay(2000))
            .subscribe({
                next: (orgs) => {
                    this.organizations.set(orgs);
                    this.isOrgsLoading.set(false);
                },
                error: () => this.isOrgsLoading.set(false),
            });
    }

    onCreateOrganization(): void {
        this.dialog.open(CreateOrganizationDialogComponent, {
            width: 'calc(100vw - 2rem)',
            height: 'calc(100vh - 2rem)',
            disableClose: true,
        });
    }

    private mapToStats(data: GetWorkspaceInfoResponse): StatCardData[] {
        return [
            {
                label: 'TOTAL ORGANIZATIONS',
                icon: 'buildings',
                value: data.organizations.value,
                delta: this.workspaceItemToDelta(data.organizations),
            },
            {
                label: 'TOTAL USERS',
                icon: 'profile',
                value: data.users.value,
                delta: this.workspaceItemToDelta(data.users),
            },
            {
                label: 'ROLES',
                icon: 'briefcase',
                value: data.roles.value,
                delta: this.workspaceItemToDelta(data.roles),
            },
            {
                label: 'RUNNING FLOWS',
                icon: 'rate',
                value: data.flows.value,
                delta: this.workspaceItemToDelta(data.flows),
            },
        ];
    }

    private workspaceItemToDelta(item: WorkspaceInfoItem): CardDeltaInfo {
        return {
            value: item.delta,
            label: 'this month',
            trend: item.trend,
            color: item.trend === 'increase' ? 'green' : 'red',
        };
    }
}
