import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import {
    GetMeResponse,
    PasswordChangeConfirmRequest,
    PasswordChangeVerifyRequest,
    PasswordChangeVerifyResponse,
    TokenPair,
    UpdateMeRequest,
    UserRole,
} from '@shared/models';
import { Observable, of, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';

import { ROLE_LABELS } from '../../features/role-base-access/constants/role-labels.constant';
import { ConfigService } from '../config';
import { ActiveOrgService } from './active-org.service';
import { PermissionsService } from './permissions.service';

@Injectable({
    providedIn: 'root',
})
export class ProfileService {
    private readonly http = inject(HttpClient);
    private readonly configService = inject(ConfigService);
    private readonly activeOrgService = inject(ActiveOrgService);
    private readonly permissionsService = inject(PermissionsService);

    private get baseUrl(): string {
        return `${this.configService.apiUrl}profile/`;
    }

    private readonly currentUser = signal<GetMeResponse | null>(null);
    currentUserSignal = this.currentUser.asReadonly();

    isMeSuperAdmin = computed(() => this.currentUser()?.is_superadmin ?? false);

    systemRole = computed(() => {
        const user = this.currentUser();
        if (!user) return '—';
        if (user.is_superadmin) return ROLE_LABELS[UserRole.SUPER_ADMIN];
        const highestRole = user.memberships.reduce<UserRole | null>(
            (best, m) => (best === null || m.role.id < best ? (m.role.id as UserRole) : best),
            null
        );
        return highestRole !== null ? (ROLE_LABELS[highestRole] ?? '—') : '—';
    });

    // TODO will be replaced with directive with migration to permission-verify logic
    canManageOrgs = computed(() => {
        const currentUser = this.currentUserSignal();
        if (!currentUser) return false;

        return currentUser.is_superadmin;
    });

    canManageUsers = computed(() => {
        const currentUser = this.currentUserSignal();
        if (!currentUser) return false;

        return currentUser.is_superadmin || currentUser.memberships.some(({ role }) => role.id === UserRole.ORG_ADMIN);
    });

    canManageRoles = computed(() => {
        const currentUser = this.currentUserSignal();
        if (!currentUser) return false;

        return currentUser.is_superadmin;
    });

    /** Simple single fetch — use for refreshing profile data mid-session. */
    getCurrentUser(): Observable<GetMeResponse> {
        return this.http.get<GetMeResponse>(this.baseUrl).pipe(tap((user) => this.setUser(user)));
    }

    /** Two-phase bootstrap: fetches profile, picks active org, re-fetches with org header
     *  to hydrate active_permissions. Called once by the route resolver on app load. */
    bootstrapUser(): Observable<GetMeResponse> {
        return this.http.get<GetMeResponse>(this.baseUrl).pipe(
            tap((user) => this.setUser(user)),
            switchMap((user) => {
                if (user.memberships.length === 0) {
                    this.permissionsService.setActivePermissions(null);
                    return of(user);
                }

                const cachedId = this.activeOrgService.activeOrgId();
                const stillValid = cachedId !== null && user.memberships.some((m) => m.organization.id === cachedId);
                const orgId = stillValid ? cachedId! : user.memberships[0].organization.id;
                this.activeOrgService.set(orgId);

                // Re-fetch with X-Organization-Id header now attached by the interceptor
                return this.http.get<GetMeResponse>(this.baseUrl).pipe(
                    tap((fullUser) => {
                        this.setUser(fullUser);
                        this.permissionsService.setActivePermissions(fullUser.active_permissions);
                    })
                );
            })
        );
    }

    updateCurrentUser(dto: UpdateMeRequest): Observable<GetMeResponse> {
        return this.http.patch<GetMeResponse>(this.baseUrl, dto).pipe(tap((user) => this.setUser(user)));
    }

    updateAvatar(avatar: FormData): Observable<GetMeResponse> {
        return this.http
            .post<GetMeResponse>(`${this.baseUrl}avatar/`, avatar)
            .pipe(tap((res) => this.updateUser({ avatar_url: res.avatar_url })));
    }

    deleteAvatar(): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}avatar/`).pipe(tap(() => this.updateUser({ avatar_url: null })));
    }

    requestPasswordChange(dto: PasswordChangeVerifyRequest): Observable<PasswordChangeVerifyResponse> {
        return this.http.post<PasswordChangeVerifyResponse>(`${this.baseUrl}password-change/request/`, dto);
    }

    confirmPasswordChange(dto: PasswordChangeConfirmRequest): Observable<TokenPair> {
        return this.http.post<TokenPair>(`${this.baseUrl}password-change/confirm/`, dto);
    }

    clearCurrentUser(): void {
        this.currentUser.set(null);
    }

    private setUser(user: GetMeResponse): void {
        this.currentUser.set(user);
    }

    private updateUser(partial: Partial<GetMeResponse>): void {
        const current = this.currentUser();
        if (!current) return;
        this.currentUser.set({ ...current, ...partial });
    }
}
