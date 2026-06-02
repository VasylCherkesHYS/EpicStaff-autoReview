import { Injectable, signal } from '@angular/core';
import { ActionCode, ActivePermissions, ResourceCode } from '@shared/models';

@Injectable({
    providedIn: 'root',
})
export class PermissionsService {
    private readonly _active = signal<ActivePermissions | null>(null);
    readonly active = this._active.asReadonly();

    setActivePermissions(p: ActivePermissions | null): void {
        this._active.set(p);
    }

    can(resource: ResourceCode, action: ActionCode): boolean {
        const p = this._active();
        if (p === null) return false;
        if (p.is_superadmin) return true;
        if (p.permissions === '*') return true;
        const actions = p.permissions[resource];
        return Array.isArray(actions) && actions.includes(action);
    }

    get isSuperadmin(): boolean {
        return this._active()?.is_superadmin === true;
    }

    get roleName(): string | null {
        return this._active()?.role?.name ?? null;
    }
}
