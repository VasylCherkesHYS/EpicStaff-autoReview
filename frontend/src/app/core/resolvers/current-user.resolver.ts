import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { GetMeResponse } from '@shared/models';
import { forkJoin, map, of } from 'rxjs';

import { PermissionsService } from '../../services/auth/permissions.service';
import { ProfileService } from '../../services/auth/profile.service';

export const currentUserResolver: ResolveFn<GetMeResponse | null> = () => {
    const profileService = inject(ProfileService);
    const rolesCatalogService = inject(PermissionsService);

    const cached = profileService.currentUserSignal();
    // Only skip bootstrap when both user AND permissions are already hydrated
    if (cached && rolesCatalogService.active() !== null) {
        rolesCatalogService.loadCatalog().subscribe();
        return of(cached);
    }

    return forkJoin([profileService.bootstrapUser(), rolesCatalogService.loadCatalog()]).pipe(map(([user]) => user));
};
