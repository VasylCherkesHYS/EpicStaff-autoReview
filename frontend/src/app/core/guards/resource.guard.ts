import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { forkJoin, map, of } from 'rxjs';

import { PermissionsService } from '../../services/auth/permissions.service';
import { ProfileService } from '../../services/auth/profile.service';

export const resourceGuard: CanActivateFn = () => {
    const profileService = inject(ProfileService);
    const permissionsService = inject(PermissionsService);
    const router = inject(Router);

    const cached = profileService.currentUserSignal();
    if (cached && permissionsService.active() !== null) {
        permissionsService.loadCatalog().subscribe();
        return of(true);
    }

    if (cached && !cached.is_superadmin && cached.memberships.length === 0) {
        return of(router.parseUrl(permissionsService.resolveDefaultRoute()));
    }

    return forkJoin([profileService.bootstrapUser(), permissionsService.loadCatalog()]).pipe(
        map(([user]) => {
            if (!user.is_superadmin && user.memberships.length === 0) {
                return router.parseUrl(permissionsService.resolveDefaultRoute());
            }
            return true;
        })
    );
};
