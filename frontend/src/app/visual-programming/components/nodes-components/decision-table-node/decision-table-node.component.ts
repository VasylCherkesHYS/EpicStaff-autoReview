import {
    Component,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    inject,
    input,
    output,
    computed,
    effect,
} from '@angular/core';
import { CommonModule, NgStyle } from '@angular/common';
import { DecisionTableNodeModel } from '../../../core/models/node.model';
import { ConditionGroup } from '../../../core/models/decision-table.model';
import { FormsModule } from '@angular/forms';
import { ClickOrDragDirective } from '../../../core/directives/click-or-drag.directive';
import { FFlowModule } from '@foblex/flow';
import { FlowService } from '../../../services/flow.service';

@Component({
    selector: 'app-decision-table-node',
    templateUrl: './decision-table-node.component.html',
    styleUrls: ['./decision-table-node.component.scss'],
    standalone: true,
    imports: [CommonModule, FormsModule, ClickOrDragDirective, FFlowModule, NgStyle],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DecisionTableNodeComponent {
    private readonly flowService = inject(FlowService);
    private readonly cdr = inject(ChangeDetectorRef);

    constructor() {
        effect(() => {
            this.flowService.nodes();
            this.flowService.connections();
            this.cdr.markForCheck();
        });
    }

    readonly node = input.required<DecisionTableNodeModel>();
    readonly actualClick = output<void>();

    readonly conditionGroups = computed<ConditionGroup[]>(() => {
        const allGroups = this.node().data.table?.condition_groups ?? [];
        return allGroups
            .filter((group) => group.valid !== false)
            .sort(
                (a, b) =>
                    (a.order ?? Number.MAX_SAFE_INTEGER) -
                    (b.order ?? Number.MAX_SAFE_INTEGER)
            );
    });

    readonly defaultNextNode = computed(() => this.node().data.table?.default_next_node);

    readonly defaultNextNodeName = computed<string | null>(() => {
        const storedValue = this.defaultNextNode();
        return this.resolveNodeName(storedValue, 'decision-default');
    });

    readonly nextErrorNode = computed(() => this.node().data.table?.next_error_node);

    readonly nextErrorNodeName = computed<string | null>(() => {
        const storedValue = this.nextErrorNode();
        return this.resolveNodeName(storedValue, 'decision-error');
    });

    private resolveNodeName(storedValue: string | null | undefined, portRole: string): string | null {
        const nodes = this.flowService.nodes();
        const connections = this.flowService.connections();
        const currentNodeId = this.node().id;

        // 1. Try direct lookup by ID or name
        if (storedValue) {
            const foundNode = nodes.find(
                (n) => n.id === storedValue || n.node_name === storedValue
            );
            if (foundNode) {
                return foundNode.node_name;
            }
        }

        // 2. Fallback: find via visual connection
        const portId = `${currentNodeId}_${portRole}`;
        const connection = connections.find(
            (c) => c.sourceNodeId === currentNodeId && String(c.sourcePortId) === portId
        );

        if (connection) {
            const targetNode = nodes.find((n) => n.id === connection.targetNodeId);
            if (targetNode) {
                return targetNode.node_name;
            }
        }

        // 3. Return stored value as last resort (might be stale)
        return storedValue ?? null;
    }

    readonly inputPort = computed(() => 
        this.node().ports?.find((p) => p.port_type === 'input')
    );

    readonly defaultPort = computed(() => 
        this.node().ports?.find((p) => p.role === 'decision-default')
    );

    readonly errorPort = computed(() => 
        this.node().ports?.find((p) => p.role === 'decision-error')
    );

    trackConditionGroup(index: number, group: ConditionGroup): string {
        const port = this.getPortForGroup(group);
        if (port) {
            return port.id;
        }

        if (group.group_name) {
            return group.group_name;
        }

        return String(index);
    }

    getPortForGroup(group: ConditionGroup) {
        const role = this.getRoleForGroup(group);
        if (!role) {
            return undefined;
        }

        return this.node().ports?.find((p) => p.role === role);
    }

    onEditClick() {
        this.actualClick.emit();
    }

    private getRoleForGroup(group: ConditionGroup): string | undefined {
        const groupName = group.group_name?.trim();
        if (!groupName) {
            return undefined;
        }

        return `decision-out-${groupName}`;
    }
}
