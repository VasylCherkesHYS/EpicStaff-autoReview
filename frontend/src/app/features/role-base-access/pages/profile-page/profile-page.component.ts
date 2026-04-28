import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
    AppSvgIconComponent,
    ButtonComponent,
    IconButtonComponent,
    ListComponent,
    ListRowComponent,
    SelectComponent,
} from '@shared/components';
import { GetUserResponse, UserRole } from '@shared/models';
import { UserService } from '@shared/services';

import { OrgAvatarComponent } from '../../components/org-avatar/org-avatar.component';
import { PasswordChangeDialogComponent } from '../../components/password-change-dialog/password-change-dialog.component';
import { ProfileEditDialogComponent } from '../../components/profile-edit-dialog/profile-edit-dialog.component';
import { UserAvatarComponent } from '../../components/user-avatar/user-avatar.component';
import { ROLE_LABELS } from '../../constants/role-labels.constant';

// Mocked until the backend provides these fields
const MOCK_CREATED = new Date('2026-03-12');
const MOCK_UPDATED = new Date('2026-03-12');

@Component({
    selector: 'app-profile-page',
    templateUrl: './profile-page.component.html',
    styleUrls: ['./profile-page.component.scss'],
    imports: [
        AppSvgIconComponent,
        ButtonComponent,
        UserAvatarComponent,
        OrgAvatarComponent,
        SelectComponent,
        ListComponent,
        ListRowComponent,
        IconButtonComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePageComponent implements OnInit {
    private dialog = inject(Dialog);
    private userService = inject(UserService);
    private destroyRef = inject(DestroyRef);

    readonly user = signal<GetUserResponse | null>(null);
    readonly isLoading = signal(true);

    readonly createdDate = MOCK_CREATED;
    readonly updatedDate = MOCK_UPDATED;

    readonly organizations = computed(() => this.user()?.organizations ?? []);

    readonly uniqueRoles = computed(() => {
        const roleSet = new Set(this.organizations().flatMap((o) => o.roles));
        return [...roleSet].map((r) => ROLE_LABELS[r] ?? r);
    });

    readonly systemRole = computed(() => {
        const orgs = this.organizations();
        if (orgs.some((o) => o.roles.includes(UserRole.SUPER_ADMIN))) {
            return ROLE_LABELS[UserRole.SUPER_ADMIN];
        }
        return ROLE_LABELS[orgs[0]?.roles[0]] ?? '—';
    });

    ngOnInit(): void {
        this.userService
            .getCurrentUser()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (user) => {
                    this.user.set(user);
                    this.isLoading.set(false);
                },
                error: () => this.isLoading.set(false),
            });
    }

    formatDate(date: Date): string {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    roleLabel(role: UserRole): string {
        return ROLE_LABELS[role] ?? role;
    }

    onPasswordChange(): void {
        this.dialog.open(PasswordChangeDialogComponent, {
            width: '560px',
        });
    }

    onSignOut(): void {}

    onProfileEdit(): void {
        this.dialog.open(ProfileEditDialogComponent, {
            width: '560px',
        });
    }
}
