import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, model, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AppSvgIconComponent } from '@shared/components';
import { OrganizationsService } from '@shared/services';

import { GetUserResponse } from '../../../../shared/models';
import { GetOrganizationsResponse } from '../../../../shared/models';

@Component({
    selector: 'app-user-menu',
    imports: [CommonModule, AppSvgIconComponent],
    templateUrl: './user-menu.component.html',
    styleUrls: ['./user-menu.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserMenuComponent implements OnInit {
    private router = inject(Router);
    private organizationsService = inject(OrganizationsService);
    private destroyRef = inject(DestroyRef);

    public user = input.required<GetUserResponse>();
    public organizations = signal<GetOrganizationsResponse[]>([]);

    isUserMenuOpen = model<boolean>(false);

    ngOnInit() {
        this.organizationsService
            .getOrganizationsByUserId(1)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((organizations) => this.organizations.set(organizations));
    }

    public onOrgClick(id: number): void {
        this.organizations.update((orgs) => {
            return orgs.map((org) => ({
                ...org,
                active: org.id === id,
            }));
        });
        this.isUserMenuOpen.set(false);
    }

    public onWorkspaceClick(): void {
        this.router.navigate(['/workspace']);
        this.isUserMenuOpen.set(false);
    }

    public onProfileClick(): void {
        console.log('My Profile clicked');
        this.isUserMenuOpen.set(false);
    }

    public onSignOutClick(): void {
        console.log('Sign out clicked');
        this.isUserMenuOpen.set(false);
    }
}
