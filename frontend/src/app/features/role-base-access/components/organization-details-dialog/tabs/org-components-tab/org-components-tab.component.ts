import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AppSvgIconComponent, SelectComponent } from '@shared/components';

import { StatCardComponent } from '../../../stat-card/stat-card.component';

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
    readonly componentGroups = COMPONENT_GROUPS;
    readonly totalComponents = COMPONENT_GROUPS.reduce((sum, g) => sum + g.items.length, 0);
}
