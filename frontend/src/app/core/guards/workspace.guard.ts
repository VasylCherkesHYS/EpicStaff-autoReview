import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ActionCode, ResourceCode } from '@shared/models';
import { map } from 'rxjs';

import { PermissionsService } from '../../services/auth/permissions.service';
import { ProfileService } from '../../services/auth/profile.service';

/**
 * Parent guard for /workspace. Runs bootstrapUser() so that permissions are set
 * before any child tab guards execute. Blocks users with no workspace access at all.
 */
export const workspaceGuard: CanActivateFn = () => {
    const profileService = inject(ProfileService);
    const permissionsService = inject(PermissionsService);
    const router = inject(Router);

    return profileService.bootstrapUser().pipe(
        map(() => {
            const hasAccess =
                permissionsService.isSuperadmin ||
                permissionsService.can('organizations', 'read') ||
                permissionsService.can('users', 'read') ||
                permissionsService.can('roles', 'read');
            return hasAccess ? true : router.parseUrl('/projects/my');
        })
    );
};

/** /workspace/main — superadmins only. */
export const superAdminGuard: CanActivateFn = () => {
    const permissionsService = inject(PermissionsService);
    const router = inject(Router);
    return permissionsService.isSuperadmin ? true : router.parseUrl('/workspace/users');
};

/**
 * Generic permission guard. Reads [ResourceCode, ActionCode] from route.data['permission'].
 * Redirects to /workspace/users on failure.
 */
export const permissionGuard: CanActivateFn = (route) => {
    const permissionsService = inject(PermissionsService);
    const router = inject(Router);
    const [resource, action] = route.data['permission'] as [ResourceCode, ActionCode];
    return permissionsService.can(resource, action) ? true : router.parseUrl('/workspace/users');
};
