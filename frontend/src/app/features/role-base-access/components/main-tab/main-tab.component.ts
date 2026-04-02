import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ButtonComponent } from '@shared/components';

import { GetOrganizationsResponse } from '../../../../shared/models';
import { ActivityItem, ActivityListComponent } from '../activity-list/activity-list.component';
import { OrgCardComponent } from '../org-card/org-card.component';
import { StatCardComponent } from '../stat-card/stat-card.component';

interface StatCard {
    label: string;
    value: number;
    delta: number | null;
    deltaLabel: string;
    icon: string;
}

@Component({
    selector: 'app-workspace-main',
    imports: [StatCardComponent, ButtonComponent, OrgCardComponent, ActivityListComponent],
    templateUrl: './main-tab.component.html',
    styleUrls: ['./main-tab.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainTabComponent {
    public stats: StatCard[] = [
        { label: 'TOTAL TEAMS', value: 3, delta: 2, deltaLabel: 'this month', icon: 'buildings' },
        { label: 'TOTAL USERS', value: 247, delta: 18, deltaLabel: 'this month', icon: 'profile' },
        { label: 'ROLES', value: 28, delta: 2, deltaLabel: 'this month', icon: 'briefcase' },
        { label: 'RUNNING FLOWS', value: 16, delta: 8, deltaLabel: 'this month', icon: 'rate' },
        { label: 'TOKEN USAGE', value: 24668224, delta: null, deltaLabel: 'this month', icon: 'token' },
    ];

    public organizations: GetOrganizationsResponse[] = [
        {
            id: 1,
            initial: 'E',
            active: true,
            name: 'EpicStaff',
            users: 34,
            projects: 34,
            agents: 34,
            tools: 34,
            flows: 34,
            knowledges: 12,
        },
        {
            id: 2,
            initial: 'E',
            active: true,
            name: 'EpicStaff',
            users: 34,
            projects: 34,
            agents: 34,
            tools: 34,
            flows: 34,
            knowledges: 12,
        },
        {
            id: 3,
            initial: 'E',
            active: true,
            name: 'EpicStaff',
            users: 34,
            projects: 34,
            agents: 34,
            tools: 34,
            flows: 34,
            knowledges: 12,
        },
        {
            id: 4,
            initial: 'E',
            active: true,
            name: 'EpicStaff',
            users: 34,
            projects: 34,
            agents: 34,
            tools: 34,
            flows: 34,
            knowledges: 12,
        },
        {
            id: 5,
            initial: 'E',
            active: true,
            name: 'EpicStaff',
            users: 34,
            projects: 34,
            agents: 34,
            tools: 34,
            flows: 34,
            knowledges: 12,
        },
    ];

    public activities: ActivityItem[] = [
        {
            id: 1,
            time: '2 min ago',
            parts: [
                { text: 'You', accent: false },
                { text: ' have added ', accent: false },
                { text: 'Ivan Bohun', accent: true },
                { text: ' to the EpicStaff team', accent: false },
            ],
        },
        {
            id: 2,
            time: '2 min ago',
            parts: [
                { text: 'Bohdan Khmelnytsky', accent: true },
                { text: ' created new flow ', accent: false },
                { text: 'Planning Assis...', accent: true },
            ],
        },
        {
            id: 3,
            time: '2 min ago',
            parts: [
                { text: 'Bohdan Khmelnytsky', accent: true },
                { text: ' created new collection ', accent: false },
                { text: 'DataVault', accent: true },
            ],
        },
        {
            id: 4,
            time: '2 min ago',
            parts: [
                { text: 'Bohdan Khmelnytsky', accent: true },
                { text: ' created new collection ', accent: false },
                { text: 'DataVault', accent: true },
            ],
        },
        {
            id: 5,
            time: '2 min ago',
            parts: [
                { text: 'Bohdan Khmelnytsky', accent: true },
                { text: ' created new collection ', accent: false },
                { text: 'DataVault', accent: true },
            ],
        },
        {
            id: 6,
            time: '2 min ago',
            parts: [
                { text: 'You', accent: false },
                { text: ' have added ', accent: false },
                { text: 'Ivan Bohun', accent: true },
                { text: ' to the EpicStaff team', accent: false },
            ],
        },
        {
            id: 7,
            time: '2 min ago',
            parts: [
                { text: 'Bohdan Khmelnytsky', accent: true },
                { text: ' created new flow ', accent: false },
                { text: 'Planning Assis...', accent: true },
            ],
        },
        {
            id: 8,
            time: '2 min ago',
            parts: [
                { text: 'Bohdan Khmelnytsky', accent: true },
                { text: ' created new flow ', accent: false },
                { text: 'Planning Assis...', accent: true },
            ],
        },
        {
            id: 9,
            time: '2 min ago',
            parts: [
                { text: 'Bohdan Khmelnytsky', accent: true },
                { text: ' created new flow ', accent: false },
                { text: 'Planning Assis...', accent: true },
            ],
        },
        {
            id: 10,
            time: '2 min ago',
            parts: [
                { text: 'You', accent: false },
                { text: ' have added ', accent: false },
                { text: 'Ivan Bohun', accent: true },
                { text: ' to the EpicStaff team', accent: false },
            ],
        },
    ];
}
