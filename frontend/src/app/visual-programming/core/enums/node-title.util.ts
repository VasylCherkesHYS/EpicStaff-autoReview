import { NodeModel } from '../models/node.model';

export function getNodeTitle(node: NodeModel): string {
    if (!node) return '';
    return node.node_name;
}
