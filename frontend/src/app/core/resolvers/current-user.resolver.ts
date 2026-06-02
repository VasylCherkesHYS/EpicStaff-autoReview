import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { GetMeResponse } from '@shared/models';
import { forkJoin, map, of } from 'rxjs';

import { RolesCatalogService } from '../../features/role-base-access/services/roles-catalog.service';
import { ProfileService } from '../../services/auth/profile.service';

export const currentUserResolver: ResolveFn<GetMeResponse | null> = () => {
    const profileService = inject(ProfileService);
    const rolesCatalogService = inject(RolesCatalogService);

    const cached = profileService.currentUserSignal();
    if (cached) {
        rolesCatalogService.loadCatalog().subscribe();
        return of(cached);
    }

    return forkJoin([profileService.bootstrapUser(), rolesCatalogService.loadCatalog()]).pipe(map(([user]) => user));
};
