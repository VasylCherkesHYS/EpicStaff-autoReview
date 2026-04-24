import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { Router } from '@angular/router';
import { AppSvgIconComponent } from '@shared/components';
import { GetUserResponse, UserOrgData } from '@shared/models';

import { OrgAvatarComponent } from '../org-avatar/org-avatar.component';
import { UserAvatarComponent } from '../user-avatar/user-avatar.component';

@Component({
    selector: 'app-user-menu',
    imports: [CommonModule, AppSvgIconComponent, UserAvatarComponent, OrgAvatarComponent],
    templateUrl: './user-menu.component.html',
    styleUrls: ['./user-menu.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserMenuComponent {
    private router = inject(Router);

    public user = input.required<GetUserResponse>();
    public organizations = computed<UserOrgData[]>(() => this.user().organizations);

    isUserMenuOpen = model<boolean>(false);

    public onOrgClick(id: number): void {
        void id;
        this.isUserMenuOpen.set(false);
    }

    public onWorkspaceClick(): void {
        this.router.navigate(['/workspace']);
        this.isUserMenuOpen.set(false);
    }

    public onProfileClick(): void {
        this.router.navigate(['/profile']);
        this.isUserMenuOpen.set(false);
    }

    public onSignOutClick(): void {
        console.log('Sign out clicked');
        this.isUserMenuOpen.set(false);
    }
}
