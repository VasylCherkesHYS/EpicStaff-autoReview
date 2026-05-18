import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { AppSvgIconComponent, CheckboxComponent, SearchComponent } from '@shared/components';
import { Permission } from '@shared/models';

import {
    ACTION_ICONS,
    PERMISSION_ACTIONS,
    PERMISSION_GROUPS,
    PermissionAction,
    PermissionGroupDef,
} from '../../constants/permission-table.constant';

@Component({
    selector: 'app-permissions-table',
    templateUrl: './permissions-table.component.html',
    styleUrls: ['./permissions-table.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [AppSvgIconComponent, SearchComponent, CheckboxComponent],
})
export class PermissionsTableComponent {
    selectedPermissions = input.required<Set<Permission>>();
    readonly = input(false);

    permissionToggle = output<Permission>();
    selectAllClick = output<void>();
    clearAllClick = output<void>();
    groupSelectAllClick = output<PermissionGroupDef>();
    groupClearClick = output<PermissionGroupDef>();

    // Internal UI state
    searchTerm = signal('');
    collapsedGroups = signal<Set<string>>(new Set());

    totalSelected = computed(() => this.selectedPermissions().size);

    filteredGroups = computed(() => {
        const term = this.searchTerm().toLowerCase().trim();
        if (!term) return PERMISSION_GROUPS;
        return PERMISSION_GROUPS.map((g) => ({
            ...g,
            resources: g.resources.filter(
                (r) => r.name.toLowerCase().includes(term) || r.description.toLowerCase().includes(term)
            ),
        }));
    });

    groupCounts = computed(() => {
        const selected = this.selectedPermissions();
        return new Map(
            PERMISSION_GROUPS.map((g) => {
                const all = g.resources
                    .flatMap((r) => Object.values(r.actions))
                    .filter((p): p is Permission => p !== undefined);
                return [g.name, { selected: all.filter((p) => selected.has(p)).length, total: all.length }];
            })
        );
    });

    isGroupCollapsed(groupName: string): boolean {
        return this.collapsedGroups().has(groupName);
    }

    toggleGroup(groupName: string): void {
        this.collapsedGroups.update((set) => {
            const next = new Set(set);
            next.has(groupName) ? next.delete(groupName) : next.add(groupName);
            return next;
        });
    }

    actionLabel(action: PermissionAction): string {
        return action.charAt(0).toUpperCase() + action.slice(1);
    }

    readonly PERMISSION_ACTIONS = PERMISSION_ACTIONS;
    readonly ACTION_ICONS = ACTION_ICONS;
}
