import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { AppSvgIconComponent, SelectComponent, SelectItem } from '@shared/components';

import { StatCardComponent } from '../../stat-card/stat-card.component';
import { StatCardData } from '../../stat-card/stat-card.interface';

interface OrgUser {
    id: number;
    initials: string;
    name: string;
    email: string;
    role: string;
}

const ROLE_FILTER_ITEMS: SelectItem[] = [
    { name: 'Super Admin', value: 'Super Admin' },
    { name: 'Flow Designer', value: 'Flow Designer' },
    { name: 'RAG Engineer', value: 'RAG Engineer' },
    { name: 'Admin', value: 'Admin' },
];

const MOCK_USERS: OrgUser[] = [
    { id: 1, initials: 'IB', name: 'Ivan Bohun', email: 'ivan_bohun@gmail.com', role: 'Super Admin' },
    { id: 2, initials: 'IB', name: 'Ivan Bohun', email: 'ivan_bohun@gmail.com', role: 'Flow Designer' },
    { id: 3, initials: 'IB', name: 'Ivan Bohun', email: 'ivan_bohun@gmail.com', role: 'RAG Engineer' },
    { id: 4, initials: 'IB', name: 'Ivan Bohun', email: 'ivan_bohun@gmail.com', role: 'Admin' },
    { id: 5, initials: 'IB', name: 'Ivan Bohun', email: 'ivan_bohun@gmail.com', role: 'Super Admin' },
    { id: 6, initials: 'IB', name: 'Ivan Bohun', email: 'ivan_bohun@gmail.com', role: 'Flow Designer' },
    { id: 7, initials: 'IB', name: 'Ivan Bohun', email: 'ivan_bohun@gmail.com', role: 'RAG Engineer' },
    { id: 8, initials: 'IB', name: 'Ivan Bohun', email: 'ivan_bohun@gmail.com', role: 'Admin' },
    { id: 9, initials: 'IB', name: 'Ivan Bohun', email: 'ivan_bohun@gmail.com', role: 'Super Admin' },
    { id: 10, initials: 'IB', name: 'Ivan Bohun', email: 'ivan_bohun@gmail.com', role: 'Flow Designer' },
    { id: 11, initials: 'IB', name: 'Ivan Bohun', email: 'ivan_bohun@gmail.com', role: 'RAG Engineer' },
    { id: 12, initials: 'IB', name: 'Ivan Bohun', email: 'ivan_bohun@gmail.com', role: 'Admin' },
];

@Component({
    selector: 'app-org-users-tab',
    templateUrl: './org-users-tab.component.html',
    styleUrls: ['./org-users-tab.component.scss'],
    imports: [StatCardComponent, SelectComponent, AppSvgIconComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrgUsersTabComponent {
    readonly stats: StatCardData[] = [
        {
            icon: 'profile',
            label: 'USERS',
            value: 34,
            delta: { value: 2, label: 'this month', trend: 'increase', color: 'green' },
        },
        {
            icon: 'briefcase',
            label: 'ROLES',
            value: 11,
            delta: { value: 2, label: 'this month', trend: 'increase', color: 'green' },
        },
    ];

    readonly roleFilter = signal<string | null>(null);
    readonly roleFilterItems = ROLE_FILTER_ITEMS;
    readonly allUsers = MOCK_USERS;

    readonly filteredUsers = computed(() => {
        const role = this.roleFilter();
        if (!role) return this.allUsers;
        return this.allUsers.filter((u) => u.role === role);
    });

    onRoleFilterChange(value: unknown): void {
        this.roleFilter.set(value as string | null);
    }
}
