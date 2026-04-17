import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AppSvgIconComponent, SelectComponent } from '@shared/components';

import { StatCardComponent } from '../../stat-card/stat-card.component';
import { StatCardData } from '../../stat-card/stat-card.interface';

interface ComponentItem {
    id: number;
    name: string;
}
interface ComponentGroup {
    key: string;
    label: string;
    icon: string;
    items: ComponentItem[];
}

const COMPONENT_GROUPS: ComponentGroup[] = [
    {
        key: 'project',
        label: 'Project',
        icon: 'folder',
        items: [
            { id: 1, name: 'Cool Title' },
            { id: 2, name: 'Cool Title' },
        ],
    },
    {
        key: 'agents',
        label: 'Agents',
        icon: 'agent',
        items: [
            { id: 1, name: 'Cool Title' },
            { id: 2, name: 'Cool Title' },
        ],
    },
    { key: 'tools', label: 'Tools', icon: 'tools', items: [{ id: 1, name: 'Cool Title' }] },
    {
        key: 'flow',
        label: 'Flow',
        icon: 'flow',
        items: [
            { id: 1, name: 'Test Flow' },
            { id: 2, name: 'Test Flow2' },
            { id: 3, name: 'Test Flow3' },
            { id: 4, name: 'Test Flow12' },
        ],
    },
    { key: 'knowledge', label: 'Knowledge Sources', icon: 'knowledge', items: [] },
];

@Component({
    selector: 'app-org-components-tab',
    templateUrl: './org-components-tab.component.html',
    styleUrls: ['./org-components-tab.component.scss'],
    imports: [StatCardComponent, AppSvgIconComponent, SelectComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrgComponentsTabComponent {
    readonly stats: StatCardData[] = [
        {
            icon: 'folder',
            label: 'PROJECTS',
            value: 2,
            delta: { value: 2, label: 'this month', trend: 'increase', color: 'green' },
        },
        {
            icon: 'agent',
            label: 'AGENTS',
            value: 2,
            delta: { value: 2, label: 'this month', trend: 'increase', color: 'green' },
        },
        {
            icon: 'tools',
            label: 'TOOLS',
            value: 1,
            delta: { value: 2, label: 'this month', trend: 'increase', color: 'green' },
        },
        {
            icon: 'flow',
            label: 'FLOWS',
            value: 4,
            delta: { value: 4, label: 'this month', trend: 'increase', color: 'green' },
        },
        {
            icon: 'knowledge',
            label: 'KNOWLEDGE SOURCES',
            value: 12,
            delta: { value: 12, label: 'this month', trend: 'increase', color: 'green' },
        },
    ];

    readonly componentGroups = COMPONENT_GROUPS;
    readonly totalComponents = COMPONENT_GROUPS.reduce((sum, g) => sum + g.items.length, 0);
}
