import { Pipe, PipeTransform } from '@angular/core';
import { NodeType } from '../enums/node-type';
import { NODE_TYPE_PREFIXES } from '../enums/node-type-prefixes';

@Pipe({
    name: 'nodeBadge',
    standalone: true,
})
export class NodeBadgePipe implements PipeTransform {
    transform(badge: string | undefined, nodeType: NodeType): string {
        if (!badge) return '';
        const prefix = NODE_TYPE_PREFIXES[nodeType] || 'Node';
        return `${badge} | ${prefix}`;
    }
}

