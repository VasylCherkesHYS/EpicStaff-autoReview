import { inject, Injectable, signal } from '@angular/core';
import { CreateRoleRequest, GetRoleResponse, UpdateRoleRequest } from '@shared/models';
import { Observable, of } from 'rxjs';

import { ConfigService } from '../../../../services/config';

const BUILT_IN_ROLES: GetRoleResponse[] = [
    {
        id: 1,
        name: 'Super Admin',
        description: 'Full system access with all permissions',
        permissions: [],
        member_count: 0,
        updated_at: '2026-03-12T10:00:00Z',
        is_built_in: true,
    },
    {
        id: 2,
        name: 'Organization Admin',
        description: 'Manage users and content within an organization',
        permissions: [],
        member_count: 0,
        updated_at: '2026-03-12T10:00:00Z',
        is_built_in: true,
    },
    {
        id: 3,
        name: 'Member',
        description: 'Standard access to workspace resources',
        permissions: [],
        member_count: 0,
        updated_at: '2026-03-12T10:00:00Z',
        is_built_in: true,
    },
    {
        id: 4,
        name: 'Viewer',
        description: 'Read-only access to workspace resources',
        permissions: [],
        member_count: 0,
        updated_at: '2026-03-12T10:00:00Z',
        is_built_in: true,
    },
];

@Injectable({
    providedIn: 'root',
})
export class RolesService {
    private readonly configService = inject(ConfigService);

    private readonly _roles = signal<GetRoleResponse[]>(BUILT_IN_ROLES);
    readonly roles = this._roles.asReadonly();

    getRoles(): Observable<GetRoleResponse[]> {
        return of(this._roles());
    }

    createRole(dto: CreateRoleRequest): Observable<GetRoleResponse> {
        const newRole: GetRoleResponse = {
            id: Date.now(),
            name: dto.name,
            description: dto.description,
            permissions: dto.permissions,
            member_count: 0,
            updated_at: new Date().toISOString(),
            is_built_in: false,
        };
        this._roles.update((roles) => [...roles, newRole]);
        return of(newRole);
    }

    updateRole(roleId: number, dto: UpdateRoleRequest): Observable<GetRoleResponse> {
        let updated!: GetRoleResponse;
        this._roles.update((roles) =>
            roles.map((r) => {
                if (r.id !== roleId) return r;
                updated = { ...r, ...dto, updated_at: new Date().toISOString() };
                return updated;
            })
        );
        return of(updated);
    }

    deleteRole(roleId: number): Observable<void> {
        this._roles.update((roles) => roles.filter((r) => r.id !== roleId));
        return of(undefined);
    }
}
